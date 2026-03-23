"""
FastAPI backend: MJPEG video + live metrics JSON file + SSE stream for the React dashboard.

Run (project root, venv activated):

  python -m uvicorn server:app --host 0.0.0.0 --port 8000

Env:
  CAMERA_ID=0
  GAZE_MODEL_PATH=l2cs_net.onnx   (skipped if file missing)
  ATTENTION_METRICS_PATH=attention_metrics.json
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

import cv2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from attention_monitor import AttentionMonitor

_state_lock = threading.Lock()
_state: Dict[str, Any] = {
    "jpeg": None,
    "metrics": {
        "timestamp": 0.0,
        "person_detected": False,
        "attention_percent": None,
        "instantaneous_percent": None,
        "label": "Starting...",
        "pose_score": None,
        "gaze_score": None,
        "smoothed_score": None,
        "instantaneous_score": None,
    },
    "running": True,
}

_camera_thread: Optional[threading.Thread] = None


def _metrics_payload(results: dict) -> Dict[str, Any]:
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


def _camera_loop(camera_id: int = 0, gaze_model_path: Optional[str] = None) -> None:
    monitor = AttentionMonitor(
        camera_id=camera_id,
        display=False,
        gaze_model_path=gaze_model_path,
    )

    try:
        monitor.initialize_camera()
    except Exception as exc:
        with _state_lock:
            _state["metrics"] = {
                "timestamp": time.time(),
                "person_detected": False,
                "attention_percent": None,
                "instantaneous_percent": None,
                "label": f"Camera error: {exc}",
                "pose_score": None,
                "gaze_score": None,
                "smoothed_score": None,
                "instantaneous_score": None,
            }
        return

    metrics_path = os.environ.get("ATTENTION_METRICS_PATH", "attention_metrics.json")

    try:
        while _state.get("running", True):
            ret, frame = monitor.cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            results = monitor.process_frame(frame)
            payload = _metrics_payload(results)

            with _state_lock:
                _state["metrics"] = payload

            try:
                with open(metrics_path, "w", encoding="utf-8") as metrics_file:
                    json.dump(payload, metrics_file, indent=2)
            except OSError:
                pass

            monitor.draw_info(
                frame,
                results.get("bbox"),
                results.get("head_pose_angles"),
                results.get("gaze_vector"),
                results.get("scores"),
                metrics=results.get("metrics"),
            )

            ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if ok:
                with _state_lock:
                    _state["jpeg"] = buffer.tobytes()
    finally:
        try:
            monitor.cleanup()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _camera_thread
    _state["running"] = True

    gaze_default = os.environ.get("GAZE_MODEL_PATH", "l2cs_net.onnx")
    gaze_path = gaze_default if os.path.isfile(gaze_default) else None
    camera_id = int(os.environ.get("CAMERA_ID", "0"))

    _camera_thread = threading.Thread(
        target=_camera_loop,
        kwargs={"camera_id": camera_id, "gaze_model_path": gaze_path},
        daemon=True,
        name="attention-camera",
    )
    _camera_thread.start()
    yield
    _state["running"] = False
    if _camera_thread is not None:
        _camera_thread.join(timeout=2.0)


app = FastAPI(title="Attention Monitoring API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _mjpeg_generator():
    boundary = b"frame"
    while True:
        with _state_lock:
            jpeg = _state.get("jpeg")
        if jpeg is None:
            time.sleep(0.05)
            continue
        yield b"--" + boundary + b"\r\n" b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
        time.sleep(0.03)


@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/api/metrics")
def get_metrics():
    with _state_lock:
        return dict(_state["metrics"])


@app.get("/api/attention/stream")
async def attention_sse():
    """Server-Sent Events: push metrics about 10 times per second."""

    async def event_gen():
        while True:
            with _state_lock:
                metrics = dict(_state["metrics"])
            yield f"data: {json.dumps(metrics)}\n\n"
            await asyncio.sleep(0.1)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
def health():
    with _state_lock:
        metrics = dict(_state["metrics"])
    return {"status": "ok", "service": "attention-monitor", "metrics": metrics}
