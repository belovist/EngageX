"""
Write live attention metrics to a JSON file (no HTTP server, no uvicorn).

Run (from project root, venv activated):
  python metrics_writer.py

Output file (default): attention_metrics.json
Override: set ATTENTION_METRICS_PATH=my_metrics.json

Press Ctrl+C to stop.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict

from attention_monitor import AttentionMonitor


def _payload(results: dict) -> Dict[str, Any]:
    metrics = results.get("metrics") or {}
    return {
        "timestamp": time.time(),
        "person_detected": bool(results.get("person_detected")),
        "attention_percent": metrics.get("attention_percent"),
        "instantaneous_percent": metrics.get("instantaneous_percent"),
        "label": metrics.get("label") or "No Data",
        "pose_score": metrics.get("pose_score"),
        "gaze_score": metrics.get("gaze_score"),
        "smoothed_score": metrics.get("smoothed_score"),
        "instantaneous_score": metrics.get("instantaneous_score"),
    }


def main() -> None:
    out_path = os.environ.get("ATTENTION_METRICS_PATH", "attention_metrics.json")
    camera_id = int(os.environ.get("CAMERA_ID", "0"))
    gaze_default = os.environ.get("GAZE_MODEL_PATH", "l2cs_net.onnx")
    gaze_path = gaze_default if os.path.isfile(gaze_default) else None

    monitor = AttentionMonitor(
        camera_id=camera_id,
        display=False,
        gaze_model_path=gaze_path,
    )

    try:
        monitor.initialize_camera()
    except Exception as exc:
        raise RuntimeError(f"Unable to initialize camera {camera_id}: {exc}") from exc

    print(f"Writing metrics to: {os.path.abspath(out_path)}")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            ret, frame = monitor.cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            results = monitor.process_frame(frame)
            payload = _payload(results)

            with open(out_path, "w", encoding="utf-8") as output_file:
                json.dump(payload, output_file, indent=2)

    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        monitor.cleanup()


if __name__ == "__main__":
    main()
