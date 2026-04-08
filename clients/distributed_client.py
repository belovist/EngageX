"""
Distributed attention client.

Runs local inference on a device and sends only attention scores to the central API.

Usage:
    python -m clients.distributed_client --user-id student-1 --server-url http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional

import cv2

# Add project root to path for imports
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from core.attention_monitor import AttentionMonitor


def post_json(url: str, payload: Dict[str, Any], timeout: float = 5.0) -> bool:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, TimeoutError):
        return False


def build_payload(user_id: str, results: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    metrics = results.get("metrics") or {}
    person_detected = bool(results.get("person_detected"))
    score = metrics.get("attention_percent")
    if not isinstance(score, (int, float)):
        score = 0.0

    return {
        "user_id": user_id,
        "score": float(score),
        "timestamp": time.time(),
        "state": metrics.get("label") or ("Tracking" if person_detected else "No person detected"),
        "person_detected": person_detected,
        "pose_score": metrics.get("pose_score"),
        "gaze_score": metrics.get("gaze_score"),
        "source": "edge-client",
    }


def post_frame(base_url: str, user_id: str, frame: Any, timestamp: float, timeout: float = 5.0) -> bool:
    ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ok:
        return False

    payload = {
        "user_id": user_id,
        "jpeg_base64": base64.b64encode(encoded.tobytes()).decode("ascii"),
        "timestamp": timestamp,
        "source": "edge-client",
    }
    endpoint = f"{base_url.rstrip('/')}/api/attention/frame"
    return post_json(endpoint, payload, timeout=timeout)


def run_client(
    user_id: str,
    server_url: str,
    camera_id: int,
    interval_sec: float,
    gaze_model_path: Optional[str],
    display: bool,
) -> None:
    endpoint = f"{server_url.rstrip('/')}/api/attention/score"
    monitor = AttentionMonitor(
        camera_id=camera_id,
        gaze_model_path=gaze_model_path,
        display=display,
    )

    last_sent = 0.0
    sent_count = 0
    fail_count = 0
    last_camera_retry = 0.0

    print(f"Starting distributed client for user_id={user_id}")
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
                ret, frame = False, None
            else:
                ret, frame = monitor.cap.read()

            if not ret:
                if now - last_sent >= interval_sec:
                    payload = {
                        "user_id": user_id,
                        "score": 0.0,
                        "timestamp": now,
                        "state": "Camera unavailable",
                        "person_detected": False,
                        "pose_score": None,
                        "gaze_score": None,
                        "source": "edge-client",
                    }
                    ok = post_json(endpoint, payload)
                    if ok:
                        sent_count += 1
                    else:
                        fail_count += 1

                    print(f"[{time.strftime('%H:%M:%S')}] camera=unavailable sent={'yes' if ok else 'no'}")
                    last_sent = now

                if monitor.cap is not None:
                    monitor.cap.release()
                    monitor.cap = None

                time.sleep(0.05)
                continue

            results = monitor.process_frame(frame)
            metrics = results.get("metrics") or {}
            output_frame = frame.copy()
            monitor.draw_info(
                output_frame,
                results.get("bbox"),
                results.get("head_pose_angles"),
                results.get("gaze_vector"),
                results.get("scores"),
                metrics=metrics,
            )

            if display:
                pass

            if now - last_sent < interval_sec:
                if display:
                    cv2.imshow(f"Attention Client - {user_id}", output_frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                continue

            payload = build_payload(user_id=user_id, results=results)
            if payload is not None:
                ok = post_json(endpoint, payload)
                frame_ok = post_frame(server_url, user_id, output_frame, payload["timestamp"])
                if ok:
                    sent_count += 1
                else:
                    fail_count += 1

                print(
                    f"[{time.strftime('%H:%M:%S')}] score={payload['score']:.1f}% "
                    f"label={payload.get('state') or 'unknown'} sent={'yes' if ok else 'no'} frame={'yes' if frame_ok else 'no'}"
                )

            last_sent = now

            if display:
                cv2.imshow(f"Attention Client - {user_id}", output_frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        print("\nInterrupted by user")

    finally:
        monitor.cleanup()
        print(f"Sent={sent_count}, Failed={fail_count}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Distributed attention score client")
    parser.add_argument("--user-id", required=True, help="Unique participant identifier")
    parser.add_argument("--server-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--camera-id", type=int, default=0, help="Camera index")
    parser.add_argument(
        "--interval",
        type=float,
        default=1.5,
        help="Score push interval in seconds (recommended 1.0-2.0)",
    )
    parser.add_argument(
        "--gaze-model-path",
        default="models/l2cs_net.onnx",
        help="Path to gaze ONNX model (if unavailable, gaze falls back gracefully)",
    )
    parser.add_argument(
        "--display",
        action="store_true",
        help="Show local OpenCV window",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_client(
        user_id=args.user_id,
        server_url=args.server_url,
        camera_id=args.camera_id,
        interval_sec=max(args.interval, 0.2),
        gaze_model_path=args.gaze_model_path,
        display=args.display,
    )


if __name__ == "__main__":
    main()
