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
import sqlite3
import threading
import time
from contextlib import asynccontextmanager
from collections import deque
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

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
_scores_lock = threading.Lock()
_latest_scores: Dict[str, Dict[str, Any]] = {}
_recent_scores: deque[Dict[str, Any]] = deque(maxlen=5000)
_db_conn: Optional[sqlite3.Connection] = None


class AttentionScoreIn(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    score: float = Field(..., ge=0.0, le=100.0)
    timestamp: Optional[float] = None
    state: Optional[str] = Field(default=None, max_length=64)
    pose_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    gaze_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    source: Optional[str] = Field(default="client")


def _init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS attention_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            score REAL NOT NULL,
            timestamp REAL NOT NULL,
            state TEXT,
            pose_score REAL,
            gaze_score REAL,
            source TEXT
        )
        """
    )
    conn.commit()
    return conn


def _persist_score(entry: Dict[str, Any]) -> None:
    if _db_conn is None:
        return

    _db_conn.execute(
        """
        INSERT INTO attention_scores (user_id, score, timestamp, state, pose_score, gaze_score, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entry["user_id"],
            entry["score"],
            entry["timestamp"],
            entry.get("state"),
            entry.get("pose_score"),
            entry.get("gaze_score"),
            entry.get("source"),
        ),
    )
    _db_conn.commit()


def _build_aggregate_snapshot() -> Dict[str, Any]:
    with _scores_lock:
        users = list(_latest_scores.values())

    scores = [u["score"] for u in users if isinstance(u.get("score"), (int, float))]
    avg = round(sum(scores) / len(scores), 2) if scores else None
    min_score = round(min(scores), 2) if scores else None
    max_score = round(max(scores), 2) if scores else None
    low_users = sorted(
        [u["user_id"] for u in users if isinstance(u.get("score"), (int, float)) and u["score"] < 50.0]
    )
    last_ts = max((u.get("timestamp", 0.0) for u in users), default=0.0)

    return {
        "active_users": len(users),
        "class_average": avg,
        "min_score": min_score,
        "max_score": max_score,
        "low_attention_users": low_users,
        "updated_at": last_ts,
    }


def _build_placeholder_jpeg(message: str) -> bytes:
    """Create a lightweight placeholder frame so MJPEG clients don't stall."""
    canvas = np.zeros((480, 640, 3), dtype=np.uint8)
    canvas[:] = (20, 20, 28)
    cv2.putText(
        canvas,
        "EngageX Live Feed",
        (24, 64),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (210, 210, 210),
        2,
    )
    cv2.putText(
        canvas,
        message[:62],
        (24, 120),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (160, 185, 255),
        2,
    )
    cv2.putText(
        canvas,
        "Backend is running. Check camera permissions or device usage.",
        (24, 168),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.52,
        (170, 170, 170),
        1,
    )
    ok, buffer = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if ok:
        return buffer.tobytes()
    return b""


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
        placeholder = _build_placeholder_jpeg(f"Camera error: {exc}")
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
            _state["jpeg"] = placeholder or _state.get("jpeg")
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
    global _db_conn
    _state["running"] = True

    db_path = os.environ.get("ATTENTION_DB_PATH", "attention_scores.db")
    _db_conn = _init_db(str(Path(db_path)))

    enable_server_camera = os.environ.get("ENABLE_SERVER_CAMERA", "1").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }

    if enable_server_camera:
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
    else:
        with _state_lock:
            _state["metrics"] = {
                "timestamp": time.time(),
                "person_detected": False,
                "attention_percent": None,
                "instantaneous_percent": None,
                "label": "Server camera disabled (distributed mode)",
                "pose_score": None,
                "gaze_score": None,
                "smoothed_score": None,
                "instantaneous_score": None,
            }
            if not _state.get("jpeg"):
                _state["jpeg"] = _build_placeholder_jpeg("Server camera disabled")
    yield
    _state["running"] = False
    if _camera_thread is not None:
        _camera_thread.join(timeout=2.0)
    if _db_conn is not None:
        _db_conn.close()
        _db_conn = None


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
    idle_ticks = 0
    while True:
        with _state_lock:
            jpeg = _state.get("jpeg")
        if jpeg is None:
            idle_ticks += 1
            if idle_ticks >= 10:
                placeholder = _build_placeholder_jpeg("Waiting for camera frames...")
                if placeholder:
                    jpeg = placeholder
                    idle_ticks = 0
                else:
                    time.sleep(0.05)
                    continue
            else:
                time.sleep(0.05)
                continue
        else:
            idle_ticks = 0
        if not jpeg:
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


@app.post("/api/attention/score")
def post_attention_score(payload: AttentionScoreIn):
    ts = float(payload.timestamp or time.time())
    entry = {
        "user_id": payload.user_id,
        "score": round(float(payload.score), 2),
        "timestamp": ts,
        "state": payload.state,
        "pose_score": payload.pose_score,
        "gaze_score": payload.gaze_score,
        "source": payload.source or "client",
    }

    with _scores_lock:
        _latest_scores[payload.user_id] = entry
        _recent_scores.append(entry)

    _persist_score(entry)
    snapshot = _build_aggregate_snapshot()
    return {"ok": True, "entry": entry, "analytics": snapshot}


@app.get("/api/attention/users")
def get_attention_users():
    with _scores_lock:
        users = sorted(_latest_scores.values(), key=lambda item: item.get("user_id", ""))
    return {"count": len(users), "users": users}


@app.get("/api/attention/analytics")
def get_attention_analytics():
    return _build_aggregate_snapshot()


@app.get("/api/attention/history/{user_id}")
def get_attention_history(user_id: str, limit: int = Query(default=100, ge=1, le=2000)):
    if _db_conn is None:
        return {"user_id": user_id, "count": 0, "history": []}

    rows = _db_conn.execute(
        """
        SELECT user_id, score, timestamp, state, pose_score, gaze_score, source
        FROM attention_scores
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()

    history = [
        {
            "user_id": row[0],
            "score": row[1],
            "timestamp": row[2],
            "state": row[3],
            "pose_score": row[4],
            "gaze_score": row[5],
            "source": row[6],
        }
        for row in rows
    ]
    return {"user_id": user_id, "count": len(history), "history": history}


@app.get("/api/attention/distributed/stream")
async def distributed_attention_sse():
    """Server-Sent Events for distributed analytics and per-user latest scores."""

    async def event_gen():
        while True:
            with _scores_lock:
                users = sorted(_latest_scores.values(), key=lambda item: item.get("user_id", ""))
            payload = {
                "analytics": _build_aggregate_snapshot(),
                "users": users,
            }
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.5)

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
