from __future__ import annotations

import asyncio
import json
import sqlite3
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field


class ScorePayload(BaseModel):
    participant_id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=128)
    attention_score: float = Field(..., ge=0, le=100)
    gaze_x: float | None = Field(default=None, ge=0, le=1)
    gaze_y: float | None = Field(default=None, ge=0, le=1)
    timestamp: float = Field(default_factory=lambda: time.time())


class LegacyAttentionScorePayload(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    score: float = Field(..., ge=0, le=100)
    timestamp: float | None = None
    state: str | None = Field(default=None, max_length=64)
    pose_score: float | None = Field(default=None, ge=0, le=1)
    gaze_score: float | None = Field(default=None, ge=0, le=1)
    source: str | None = Field(default="client")


class ScoreStore:
    def __init__(self, db_path: str = "attention_scores.db") -> None:
        resolved = Path(db_path)
        if not resolved.is_absolute():
            resolved = Path(__file__).resolve().parent / resolved
        self.db_path = resolved
        self._lock = threading.Lock()
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._create_tables()

    def _create_tables(self) -> None:
        with self._lock:
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS attention_scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    score REAL NOT NULL,
                    timestamp REAL NOT NULL,
                    state TEXT,
                    source TEXT
                )
                """
            )
            self.conn.commit()

    def insert_score(self, row: Dict) -> None:
        with self._lock:
            self.conn.execute(
                "INSERT INTO attention_scores (user_id, score, timestamp, state, source) VALUES (?, ?, ?, ?, ?)",
                (
                    row["user_id"],
                    row["score"],
                    row["timestamp"],
                    row.get("state"),
                    row.get("source"),
                ),
            )
            self.conn.commit()

    def latest_users(self) -> List[Dict]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT user_id, score, timestamp, state, source
                FROM attention_scores
                WHERE id IN (
                    SELECT MAX(id)
                    FROM attention_scores
                    GROUP BY user_id
                )
                ORDER BY user_id
                """
            ).fetchall()

        return [
            {
                "user_id": r[0],
                "score": r[1],
                "timestamp": r[2],
                "state": r[3],
                "source": r[4],
            }
            for r in rows
        ]

    def user_history(self, user_id: str, limit: int = 100) -> List[Dict]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT user_id, score, timestamp, state, source
                FROM attention_scores
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (user_id, int(limit)),
            ).fetchall()

        return [
            {
                "user_id": r[0],
                "score": r[1],
                "timestamp": r[2],
                "state": r[3],
                "source": r[4],
            }
            for r in rows
        ]

    def close(self) -> None:
        try:
            with self._lock:
                self.conn.close()
        except Exception:
            pass


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self.lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self.lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        async with self.lock:
            clients = list(self.active_connections)

        stale: List[WebSocket] = []
        for connection in clients:
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)

        if stale:
            async with self.lock:
                self.active_connections = [c for c in self.active_connections if c not in stale]


score_store = ScoreStore()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = app
    yield
    score_store.close()


app = FastAPI(title="EngageX Unified Backend Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
latest_scores: Dict[str, dict] = {}
SCORE_TTL_SECONDS = 8.0


def _is_participant_source(entry: dict) -> bool:
    source = str(entry.get("source") or "").strip().lower()
    return source in {"edge-client", "legacy-client", "participant-client"}


def _to_legacy_user(entry: dict) -> dict:
    return {
        "user_id": entry["participant_id"],
        "score": entry["attention_score"],
        "timestamp": entry.get("timestamp", time.time()),
        "state": "Attentive" if entry["attention_score"] >= 60 else "Distracted",
        "pose_score": entry.get("pose_score"),
        "gaze_score": entry.get("gaze_score"),
        "source": entry.get("source", "compat-server"),
    }


def _users_snapshot() -> List[dict]:
    return sorted(latest_scores.values(), key=lambda item: item.get("participant_id", ""))


def _persist_participant_entry(entry: dict) -> None:
    score = float(entry.get("attention_score", 0.0))
    row = {
        "user_id": str(entry.get("participant_id") or "unknown"),
        "score": max(0.0, min(100.0, score)),
        "timestamp": float(entry.get("timestamp") or time.time()),
        "state": "Attentive" if score >= 60.0 else "Distracted",
        "source": entry.get("source") or "compat-server",
    }
    score_store.insert_score(row)


def _fresh_users_snapshot(participant_only: bool = True) -> List[dict]:
    now = time.time()
    fresh: List[dict] = []

    for item in _users_snapshot():
        if participant_only and not _is_participant_source(item):
            continue
        ts = float(item.get("timestamp", 0.0) or 0.0)
        if ts > now + 5:
            ts = now
        if now - ts <= SCORE_TTL_SECONDS:
            fresh.append(item)

    return fresh


def _analytics_snapshot() -> dict:
    users = _fresh_users_snapshot(participant_only=True)
    now = time.time()
    scores = [u["attention_score"] for u in users if isinstance(u.get("attention_score"), (int, float))]
    class_average = round(sum(scores) / len(scores), 2) if scores else None
    min_score = round(min(scores), 2) if scores else None
    max_score = round(max(scores), 2) if scores else None
    low_attention_users = [u["participant_id"] for u in users if u.get("attention_score", 0) < 50]
    sanitized_timestamps: List[float] = []
    for user in users:
        ts = float(user.get("timestamp", 0.0) or 0.0)
        # Clamp obviously future timestamps to avoid freezing chart updates.
        if ts > now + 5:
            ts = now
        sanitized_timestamps.append(ts)

    updated_at = max(sanitized_timestamps, default=now)

    return {
        "active_users": len(users),
        "class_average": class_average,
        "min_score": min_score,
        "max_score": max_score,
        "low_attention_users": low_attention_users,
        "updated_at": updated_at,
    }


def _build_analytics_from_legacy(users: list[dict]) -> dict:
    scores = [float(u["score"]) for u in users if isinstance(u.get("score"), (int, float))]
    class_average = round(sum(scores) / len(scores), 2) if scores else None
    min_score = round(min(scores), 2) if scores else None
    max_score = round(max(scores), 2) if scores else None
    low_users = sorted([u["user_id"] for u in users if float(u["score"]) < 50.0])
    updated_at = max((float(u.get("timestamp", 0.0)) for u in users), default=0.0)

    return {
        "active_users": len(users),
        "class_average": class_average,
        "min_score": min_score,
        "max_score": max_score,
        "low_attention_users": low_users,
        "updated_at": updated_at,
    }


def _metrics_snapshot() -> dict:
    analytics = _analytics_snapshot()
    users = _fresh_users_snapshot(participant_only=True)
    pose_values = [u.get("pose_score") for u in users if isinstance(u.get("pose_score"), (int, float))]
    gaze_values = [u.get("gaze_score") for u in users if isinstance(u.get("gaze_score"), (int, float))]

    attention = analytics["class_average"]
    return {
        "timestamp": analytics["updated_at"] or time.time(),
        "person_detected": analytics["active_users"] > 0,
        "attention_percent": attention,
        "instantaneous_percent": attention,
        "label": "Tracking" if analytics["active_users"] > 0 else "No person detected",
        "pose_score": round(sum(pose_values) / len(pose_values), 3) if pose_values else None,
        "gaze_score": round(sum(gaze_values) / len(gaze_values), 3) if gaze_values else None,
        "smoothed_score": round(attention / 100, 3) if attention is not None else None,
        "instantaneous_score": round(attention / 100, 3) if attention is not None else None,
    }


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "engagex-unified-backend",
        "participants": len(_fresh_users_snapshot(participant_only=True)),
    }


@app.post("/api/score")
async def post_score(payload: ScorePayload) -> dict:
    data = payload.model_dump()
    data["pose_score"] = data.get("gaze_y")
    data["gaze_score"] = data.get("gaze_x")
    data["source"] = "score-api"
    latest_scores[payload.participant_id] = data
    _persist_participant_entry(data)
    await manager.broadcast(data)
    return {"ok": True, "participant_id": payload.participant_id}


@app.get("/api/scores")
async def get_scores() -> dict:
    return {"participants": _fresh_users_snapshot(participant_only=True)}


@app.post("/api/attention/score")
async def post_legacy_score(payload: LegacyAttentionScorePayload) -> dict:
    mapped = {
        "participant_id": payload.user_id,
        "name": payload.user_id,
        "attention_score": round(float(payload.score), 2),
        "gaze_x": payload.gaze_score,
        "gaze_y": payload.pose_score,
        "timestamp": float(payload.timestamp or time.time()),
        "pose_score": payload.pose_score,
        "gaze_score": payload.gaze_score,
        "source": payload.source or "legacy-client",
    }

    latest_scores[payload.user_id] = mapped
    _persist_participant_entry(mapped)
    await manager.broadcast(mapped)
    return {"ok": True, "entry": _to_legacy_user(mapped), "analytics": _analytics_snapshot()}


@app.post("/attention_score")
async def post_attention_score_compat(payload: LegacyAttentionScorePayload) -> dict:
    return await post_legacy_score(payload)


@app.get("/api/attention/users")
async def get_legacy_users() -> dict:
    users = [_to_legacy_user(user) for user in _fresh_users_snapshot(participant_only=True)]
    return {"count": len(users), "users": users}


@app.get("/api/attention/analytics")
async def get_legacy_analytics() -> dict:
    return _analytics_snapshot()


@app.get("/analytics/users")
async def analytics_users_compat() -> dict:
    users = score_store.latest_users()
    return {"count": len(users), "users": users}


@app.get("/api/attention/history/{user_id}")
async def api_attention_history(user_id: str, limit: int = Query(default=100, ge=1, le=5000)) -> dict:
    history = score_store.user_history(user_id=user_id, limit=limit)
    return {"user_id": user_id, "count": len(history), "history": history}


@app.get("/api/metrics")
async def get_metrics() -> dict:
    return _metrics_snapshot()


@app.get("/api/attention/stream")
async def attention_sse() -> StreamingResponse:
    async def event_gen():
        while True:
            payload = _metrics_snapshot()
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


@app.get("/api/attention/distributed/stream")
async def distributed_attention_sse() -> StreamingResponse:
    async def event_gen():
        while True:
            users = [_to_legacy_user(user) for user in _fresh_users_snapshot(participant_only=True)]
            payload = {"users": users, "analytics": _analytics_snapshot()}
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0.7)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/attention/distributed/stream/persistent")
async def distributed_attention_sse_persistent() -> StreamingResponse:
    async def event_gen():
        while True:
            users = score_store.latest_users()
            payload = {
                "users": users,
                "analytics": _build_analytics_from_legacy(users),
            }
            yield f"data: {json.dumps(payload)}\\n\\n"
            await asyncio.sleep(0.7)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/video_feed")
async def video_feed() -> Response:
    # Compatibility placeholder so legacy host UI can render a feed area even
    # when camera streaming is handled by external clients.
    svg = """
<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'>
  <rect width='100%' height='100%' fill='#0f172a'/>
  <text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' fill='#cbd5e1' font-family='Segoe UI, sans-serif' font-size='40'>EngageX Feed</text>
  <text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='#93c5fd' font-family='Segoe UI, sans-serif' font-size='24'>Waiting for camera stream input</text>
</svg>
""".strip()
    return Response(content=svg, media_type="image/svg+xml")


@app.websocket("/ws/scores")
async def websocket_scores(websocket: WebSocket) -> None:
    await manager.connect(websocket)

    try:
        # Send initial snapshot so newly connected clients have immediate state.
        await websocket.send_json({"participants": list(latest_scores.values())})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
