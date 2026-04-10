"""
Distributed LAN attention client.

Runs local inference on a participant device and sends lightweight JSON scores
to the admin laptop over REST.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict

import cv2

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from core.attention_monitor import AttentionMonitor


def post_json(url: str, payload: Dict[str, Any], timeout: float = 5.0) -> bool:
    request = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return 200 <= getattr(response, "status", 500) < 300
    except (urllib.error.URLError, TimeoutError):
        return False


def build_payload(session_id: str, user_id: str, results: Dict[str, Any]) -> Dict[str, Any]:
    metrics = results.get("metrics") or {}
    person_detected = bool(results.get("person_detected"))
    score = metrics.get("attention_percent")
    if not isinstance(score, (int, float)):
        score = 0.0

    return {
        "session_id": session_id,
        "user_id": user_id,
        "score": float(score),
        "timestamp": time.time(),
        "state": metrics.get("label") or ("Tracking" if person_detected else "No person detected"),
        "person_detected": person_detected,
        "pose_score": metrics.get("pose_score"),
        "gaze_score": metrics.get("gaze_score"),
        "source": "participant-client",
    }


def build_camera_unavailable_payload(session_id: str, user_id: str) -> Dict[str, Any]:
    return {
        "session_id": session_id,
        "user_id": user_id,
        "score": 0.0,
        "timestamp": time.time(),
        "state": "Camera unavailable",
        "person_detected": False,
        "pose_score": None,
        "gaze_score": None,
        "source": "participant-client",
    }


def run_client(
    session_id: str,
    user_id: str,
    server_url: str,
    camera_id: int,
    interval_sec: float,
    gaze_model_path: str | None,
    display: bool,
) -> None:
    endpoint = f"{server_url.rstrip('/')}/api/sessions/{session_id}/scores"
    monitor = AttentionMonitor(
        camera_id=camera_id,
        gaze_model_path=gaze_model_path,
        display=display,
    )

    sent_count = 0
    failed_count = 0
    last_camera_retry = 0.0

    print(f"Starting participant client for session_id={session_id} user_id={user_id}")
    print(f"Posting scores to {endpoint} every {interval_sec:.1f}s")
    print("Press Ctrl+C to stop")

    try:
        while True:
            now = time.time()

            if monitor.cap is None and now - last_camera_retry >= 2.0:
                try:
                    monitor.initialize_camera()
                except RuntimeError as exc:
                    print(f"[{time.strftime('%H:%M:%S')}] camera init failed: {exc}")
                last_camera_retry = now

            if monitor.cap is None:
                payload = build_camera_unavailable_payload(session_id=session_id, user_id=user_id)
                ok = post_json(endpoint, payload)
                sent_count += 1 if ok else 0
                failed_count += 0 if ok else 1
                print(f"[{time.strftime('%H:%M:%S')}] camera=unavailable sent={'yes' if ok else 'no'}")
                time.sleep(interval_sec)
                continue

            ok, frame = monitor.cap.read()
            if not ok or frame is None:
                monitor.cap.release()
                monitor.cap = None
                payload = build_camera_unavailable_payload(session_id=session_id, user_id=user_id)
                sent = post_json(endpoint, payload)
                sent_count += 1 if sent else 0
                failed_count += 0 if sent else 1
                print(f"[{time.strftime('%H:%M:%S')}] camera=read-failed sent={'yes' if sent else 'no'}")
                time.sleep(interval_sec)
                continue

            results = monitor.process_frame(frame)
            payload = build_payload(session_id=session_id, user_id=user_id, results=results)
            sent = post_json(endpoint, payload)
            sent_count += 1 if sent else 0
            failed_count += 0 if sent else 1

            print(
                f"[{time.strftime('%H:%M:%S')}] "
                f"score={payload['score']:.1f}% "
                f"state={payload['state']} "
                f"sent={'yes' if sent else 'no'}"
            )

            if display:
                preview = frame.copy()
                monitor.draw_info(
                    preview,
                    results.get("bbox"),
                    results.get("head_pose_angles"),
                    results.get("gaze_vector"),
                    results.get("scores"),
                    metrics=results.get("metrics"),
                )
                cv2.imshow(f"EngageX Participant - {user_id}", preview)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            time.sleep(interval_sec)

    except KeyboardInterrupt:
        print("\nInterrupted by user")
    finally:
        monitor.cleanup()
        print(f"Sent={sent_count}, Failed={failed_count}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Distributed LAN attention score client")
    parser.add_argument("--session-id", required=True, help="Session identifier from the admin laptop")
    parser.add_argument("--user-id", required=True, help="Unique participant identifier")
    parser.add_argument("--server-url", required=True, help="Admin backend base URL, for example http://192.168.0.25:8000")
    parser.add_argument("--camera-id", type=int, default=0, help="Camera index")
    parser.add_argument(
        "--interval",
        type=float,
        default=3.0,
        help="Score push interval in seconds",
    )
    parser.add_argument(
        "--gaze-model-path",
        default="models/l2cs_net.onnx",
        help="Path to gaze ONNX model",
    )
    parser.add_argument(
        "--display",
        action="store_true",
        help="Show a local OpenCV preview window",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_client(
        session_id=args.session_id,
        user_id=args.user_id,
        server_url=args.server_url,
        camera_id=args.camera_id,
        interval_sec=max(args.interval, 1.0),
        gaze_model_path=args.gaze_model_path,
        display=args.display,
    )


if __name__ == "__main__":
    main()
