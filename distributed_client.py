"""
Distributed attention client.

Runs local inference on a device and sends only attention scores to the central API.

Usage:
    python distributed_client.py --user-id student-1 --server-url http://127.0.0.1:8010
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from attention_monitor import AttentionMonitor


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


def build_payload(user_id: str, metrics: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    score = metrics.get("attention_percent")
    if not isinstance(score, (int, float)):
        return None

    return {
        "user_id": user_id,
        "score": float(score),
        "timestamp": time.time(),
        "state": metrics.get("label"),
        "pose_score": metrics.get("pose_score"),
        "gaze_score": metrics.get("gaze_score"),
        "source": "edge-client",
    }


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
    monitor.initialize_camera()

    last_sent = 0.0
    sent_count = 0
    fail_count = 0

    print(f"Starting distributed client for user_id={user_id}")
    print(f"Posting scores to {endpoint} every {interval_sec:.1f}s")
    print("Press Ctrl+C to stop")

    try:
        while True:
            ret, frame = monitor.cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            results = monitor.process_frame(frame)
            metrics = results.get("metrics") or {}

            if display:
                monitor.draw_info(
                    frame,
                    results.get("bbox"),
                    results.get("head_pose_angles"),
                    results.get("gaze_vector"),
                    results.get("scores"),
                    metrics=metrics,
                )

            now = time.time()
            if now - last_sent < interval_sec:
                if display:
                    import cv2

                    cv2.imshow(f"Attention Client - {user_id}", frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                continue

            payload = build_payload(user_id=user_id, metrics=metrics)
            if payload is not None:
                ok = post_json(endpoint, payload)
                if ok:
                    sent_count += 1
                else:
                    fail_count += 1

                print(
                    f"[{time.strftime('%H:%M:%S')}] score={payload['score']:.1f}% "
                    f"label={payload.get('state') or 'unknown'} sent={'yes' if ok else 'no'}"
                )

            last_sent = now

            if display:
                import cv2

                cv2.imshow(f"Attention Client - {user_id}", frame)
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
    parser.add_argument("--server-url", default="http://127.0.0.1:8010", help="Backend base URL")
    parser.add_argument("--camera-id", type=int, default=0, help="Camera index")
    parser.add_argument(
        "--interval",
        type=float,
        default=1.5,
        help="Score push interval in seconds (recommended 1.0-2.0)",
    )
    parser.add_argument(
        "--gaze-model-path",
        default="l2cs_net.onnx",
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
