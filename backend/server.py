from __future__ import annotations

import hashlib
import socket
import sqlite3
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


def _normalize_meeting_link(meeting_link: str) -> str:
    normalized = meeting_link.strip()
    if not normalized:
        raise ValueError("Meeting link cannot be empty.")
    return normalized


def _build_session_id(meeting_link: str) -> str:
    normalized = _normalize_meeting_link(meeting_link).lower()
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:10].upper()
    return f"SES-{digest}"


def _detect_lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip_address = sock.getsockname()[0]
            if ip_address and not ip_address.startswith("127."):
                return ip_address
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for _, _, _, _, sockaddr in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip_address = sockaddr[0]
            if ip_address and not ip_address.startswith("127."):
                return ip_address
    except OSError:
        pass

    return "127.0.0.1"


def _clamp_score(score: float) -> float:
    return max(0.0, min(100.0, float(score)))


class SessionCreatePayload(BaseModel):
    meeting_link: str = Field(..., min_length=3, max_length=4096)


class SessionScorePayload(BaseModel):
    session_id: str | None = Field(default=None, min_length=4, max_length=64)
    user_id: str = Field(..., min_length=1, max_length=128)
    score: float = Field(..., ge=0, le=100)
    timestamp: float | None = None
    state: str | None = Field(default=None, max_length=64)
    person_detected: bool | None = None
    pose_score: float | None = Field(default=None, ge=0, le=1)
    gaze_score: float | None = Field(default=None, ge=0, le=1)
    source: str | None = Field(default="participant-client", max_length=64)


class LegacyAttentionScorePayload(BaseModel):
    session_id: str | None = Field(default=None, min_length=4, max_length=64)
    user_id: str = Field(..., min_length=1, max_length=128)
    score: float = Field(..., ge=0, le=100)
    timestamp: float | None = None
    state: str | None = Field(default=None, max_length=64)
    person_detected: bool | None = None
    pose_score: float | None = Field(default=None, ge=0, le=1)
    gaze_score: float | None = Field(default=None, ge=0, le=1)
    source: str | None = Field(default="legacy-client", max_length=64)


class LegacyScorePayload(BaseModel):
    participant_id: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=128)
    attention_score: float = Field(..., ge=0, le=100)
    gaze_x: float | None = Field(default=None, ge=0, le=1)
    gaze_y: float | None = Field(default=None, ge=0, le=1)
    timestamp: float = Field(default_factory=lambda: time.time())
    session_id: str | None = Field(default=None, min_length=4, max_length=64)


class SessionStore:
    def __init__(self, db_path: str = "engagex_lan.db") -> None:
        resolved = Path(db_path)
        if not resolved.is_absolute():
            resolved = Path(__file__).resolve().parent / resolved
        self.db_path = resolved
        self._lock = threading.Lock()
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self) -> None:
        with self._lock:
            self.conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    meeting_link TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    score REAL NOT NULL,
                    timestamp REAL NOT NULL,
                    state TEXT,
                    person_detected INTEGER,
                    pose_score REAL,
                    gaze_score REAL,
                    source TEXT,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                );

                CREATE INDEX IF NOT EXISTS idx_scores_session_user_time
                ON scores(session_id, user_id, timestamp DESC);

                CREATE INDEX IF NOT EXISTS idx_scores_session_time
                ON scores(session_id, timestamp DESC);
                """
            )
            self.conn.commit()

    def close(self) -> None:
        try:
            with self._lock:
                self.conn.close()
        except Exception:
            pass

    def create_or_update_session(self, meeting_link: str) -> dict:
        normalized_link = _normalize_meeting_link(meeting_link)
        session_id = _build_session_id(normalized_link)
        now = time.time()

        with self._lock:
            existing = self.conn.execute(
                "SELECT session_id FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()

            if existing is None:
                self.conn.execute(
                    """
                    INSERT INTO sessions (session_id, meeting_link, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (session_id, normalized_link, now, now),
                )
            else:
                self.conn.execute(
                    """
                    UPDATE sessions
                    SET meeting_link = ?, updated_at = ?
                    WHERE session_id = ?
                    """,
                    (normalized_link, now, session_id),
                )
            self.conn.commit()

        return self.get_session(session_id)

    def list_sessions(self, limit: int = 20) -> List[dict]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT
                    s.session_id,
                    s.meeting_link,
                    s.created_at,
                    s.updated_at,
                    COUNT(sc.id) AS total_samples,
                    COUNT(DISTINCT sc.user_id) AS total_participants
                FROM sessions s
                LEFT JOIN scores sc ON sc.session_id = s.session_id
                GROUP BY s.session_id
                ORDER BY s.updated_at DESC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()

        return [dict(row) for row in rows]

    def latest_session_id(self) -> str | None:
        with self._lock:
            row = self.conn.execute(
                "SELECT session_id FROM sessions ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()
        if row is None:
            return None
        return str(row["session_id"])

    def get_session(self, session_id: str) -> dict | None:
        with self._lock:
            row = self.conn.execute(
                """
                SELECT
                    s.session_id,
                    s.meeting_link,
                    s.created_at,
                    s.updated_at,
                    COUNT(sc.id) AS total_samples,
                    COUNT(DISTINCT sc.user_id) AS total_participants
                FROM sessions s
                LEFT JOIN scores sc ON sc.session_id = s.session_id
                WHERE s.session_id = ?
                GROUP BY s.session_id
                """,
                (session_id,),
            ).fetchone()

        if row is None:
            return None
        return dict(row)

    def _session_exists(self, session_id: str) -> bool:
        with self._lock:
            row = self.conn.execute(
                "SELECT 1 FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return row is not None

    def insert_score(self, session_id: str, payload: dict) -> dict:
        if not self._session_exists(session_id):
            raise KeyError(session_id)

        timestamp = float(payload.get("timestamp") or time.time())
        row = {
            "session_id": session_id,
            "user_id": str(payload["user_id"]),
            "score": _clamp_score(float(payload["score"])),
            "timestamp": timestamp,
            "state": payload.get("state"),
            "person_detected": 1 if payload.get("person_detected") else 0,
            "pose_score": payload.get("pose_score"),
            "gaze_score": payload.get("gaze_score"),
            "source": payload.get("source") or "participant-client",
        }

        with self._lock:
            cursor = self.conn.execute(
                """
                INSERT INTO scores (
                    session_id,
                    user_id,
                    score,
                    timestamp,
                    state,
                    person_detected,
                    pose_score,
                    gaze_score,
                    source
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["session_id"],
                    row["user_id"],
                    row["score"],
                    row["timestamp"],
                    row["state"],
                    row["person_detected"],
                    row["pose_score"],
                    row["gaze_score"],
                    row["source"],
                ),
            )
            self.conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (timestamp, session_id),
            )
            self.conn.commit()
            row["id"] = cursor.lastrowid

        return self._serialize_score(row)

    def _serialize_score(self, row: dict | sqlite3.Row) -> dict:
        raw = dict(row)
        return {
            "id": raw.get("id"),
            "session_id": raw["session_id"],
            "user_id": raw["user_id"],
            "score": round(float(raw["score"]), 2),
            "timestamp": float(raw["timestamp"]),
            "state": raw.get("state"),
            "person_detected": bool(raw.get("person_detected")),
            "pose_score": raw.get("pose_score"),
            "gaze_score": raw.get("gaze_score"),
            "source": raw.get("source"),
        }

    def participant_histories(self, session_id: str, limit_per_user: int = 30) -> Dict[str, List[dict]]:
        participants = self.participant_summaries(session_id)
        histories: Dict[str, List[dict]] = {}
        for participant in participants:
            histories[participant["user_id"]] = self.user_history(
                session_id=session_id,
                user_id=participant["user_id"],
                limit=limit_per_user,
            )
        return histories

    def user_history(self, session_id: str, user_id: str, limit: int = 60) -> List[dict]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT id, session_id, user_id, score, timestamp, state, person_detected, pose_score, gaze_score, source
                FROM scores
                WHERE session_id = ? AND user_id = ?
                ORDER BY timestamp DESC, id DESC
                LIMIT ?
                """,
                (session_id, user_id, int(limit)),
            ).fetchall()

        history = [self._serialize_score(row) for row in rows]
        history.reverse()
        return history

    def participant_summaries(self, session_id: str) -> List[dict]:
        with self._lock:
            latest_rows = self.conn.execute(
                """
                SELECT
                    sc.session_id,
                    sc.user_id,
                    sc.score,
                    sc.timestamp,
                    sc.state,
                    sc.person_detected,
                    sc.pose_score,
                    sc.gaze_score,
                    sc.source,
                    sc.id
                FROM scores sc
                INNER JOIN (
                    SELECT user_id, MAX(id) AS max_id
                    FROM scores
                    WHERE session_id = ?
                    GROUP BY user_id
                ) latest ON latest.max_id = sc.id
                ORDER BY sc.user_id
                """,
                (session_id,),
            ).fetchall()

            aggregate_rows = self.conn.execute(
                """
                SELECT
                    user_id,
                    COUNT(*) AS total_samples,
                    AVG(score) AS average_score,
                    MAX(timestamp) AS last_seen
                FROM scores
                WHERE session_id = ?
                GROUP BY user_id
                ORDER BY user_id
                """,
                (session_id,),
            ).fetchall()

        aggregates = {str(row["user_id"]): dict(row) for row in aggregate_rows}
        participants: List[dict] = []

        for row in latest_rows:
            serialized = self._serialize_score(row)
            user_id = serialized["user_id"]
            aggregate = aggregates.get(user_id, {})
            participants.append(
                {
                    "user_id": user_id,
                    "participant_id": user_id,
                    "name": user_id,
                    "latest_score": serialized["score"],
                    "attention_score": serialized["score"],
                    "average_score": round(float(aggregate.get("average_score", serialized["score"])), 2),
                    "total_samples": int(aggregate.get("total_samples", 1)),
                    "last_seen": float(aggregate.get("last_seen", serialized["timestamp"])),
                    "timestamp": serialized["timestamp"],
                    "latest_state": serialized.get("state"),
                    "state": serialized.get("state"),
                    "person_detected": serialized.get("person_detected"),
                    "pose_score": serialized.get("pose_score"),
                    "gaze_score": serialized.get("gaze_score"),
                    "gaze_x": serialized.get("gaze_score"),
                    "gaze_y": serialized.get("pose_score"),
                    "source": serialized.get("source"),
                }
            )

        return participants

    def session_detail(self, session_id: str, limit_per_user: int = 30) -> dict | None:
        session = self.get_session(session_id)
        if session is None:
            return None

        participants = self.participant_summaries(session_id)
        scores_by_user = self.participant_histories(session_id, limit_per_user=limit_per_user)
        latest_scores = [participant["latest_score"] for participant in participants]
        last_updated = max((participant["last_seen"] for participant in participants), default=session["updated_at"])

        summary = {
            "participant_count": len(participants),
            "total_samples": int(session["total_samples"]),
            "average_score": round(sum(latest_scores) / len(latest_scores), 2) if latest_scores else 0.0,
            "last_updated": float(last_updated or time.time()),
        }

        return {
            "session": {
                "session_id": session["session_id"],
                "meeting_link": session["meeting_link"],
                "created_at": float(session["created_at"]),
                "updated_at": float(session["updated_at"]),
                "total_samples": int(session["total_samples"]),
                "total_participants": int(session["total_participants"]),
            },
            "summary": summary,
            "participants": participants,
            "scores_by_user": scores_by_user,
        }


store = SessionStore()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = app
    yield
    store.close()


app = FastAPI(title="EngageX LAN Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)


@app.middleware("http")
async def allow_private_network_access(request: Request, call_next):
    response = await call_next(request)

    if request.headers.get("access-control-request-private-network", "").lower() == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        vary_header = response.headers.get("Vary")
        if vary_header:
            if "Access-Control-Request-Private-Network" not in vary_header:
                response.headers["Vary"] = f"{vary_header}, Access-Control-Request-Private-Network"
        else:
            response.headers["Vary"] = "Access-Control-Request-Private-Network"

    return response


def _system_info() -> dict:
    server_ip = _detect_lan_ip()
    return {
        "server_ip": server_ip,
        "backend_url": f"http://{server_ip}:8000",
        "host": "0.0.0.0",
        "port": 8000,
        "rest_only": True,
    }


def _latest_session_or_404() -> str:
    session_id = store.latest_session_id()
    if not session_id:
        raise HTTPException(status_code=404, detail="No session has been created yet.")
    return session_id


@app.get("/health")
def health() -> dict:
    latest_session_id = store.latest_session_id()
    latest_detail = store.session_detail(latest_session_id) if latest_session_id else None
    return {
        "status": "ok",
        "service": "engagex-lan-backend",
        "transport": "json-rest",
        "server": _system_info(),
        "active_session_id": latest_session_id,
        "participant_count": int((latest_detail or {}).get("summary", {}).get("participant_count", 0)),
    }


@app.get("/api/system/info")
def get_system_info() -> dict:
    return _system_info()


@app.get("/api/admin/sessions")
def get_recent_sessions(limit: int = Query(default=20, ge=1, le=100)) -> dict:
    return {"sessions": store.list_sessions(limit=limit), "server": _system_info()}


@app.post("/api/admin/session")
def create_session(payload: SessionCreatePayload) -> dict:
    try:
        session = store.create_or_update_session(payload.meeting_link)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    detail = store.session_detail(session["session_id"], limit_per_user=10)
    return {
        "ok": True,
        "server": _system_info(),
        "session": detail["session"],
        "summary": detail["summary"],
    }


@app.get("/api/sessions/{session_id}")
def get_session_detail(session_id: str, limit_per_user: int = Query(default=30, ge=1, le=200)) -> dict:
    detail = store.session_detail(session_id=session_id, limit_per_user=limit_per_user)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' was not found.")
    return {**detail, "server": _system_info()}


@app.get("/api/sessions/{session_id}/participants")
def get_session_participants(session_id: str) -> dict:
    detail = store.session_detail(session_id=session_id, limit_per_user=1)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' was not found.")
    return {"session_id": session_id, "participants": detail["participants"], "summary": detail["summary"]}


@app.get("/api/sessions/{session_id}/participants/{user_id}")
def get_participant_history(
    session_id: str,
    user_id: str,
    limit: int = Query(default=60, ge=1, le=500),
) -> dict:
    detail = store.session_detail(session_id=session_id, limit_per_user=1)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' was not found.")

    history = store.user_history(session_id=session_id, user_id=user_id, limit=limit)
    latest = next((participant for participant in detail["participants"] if participant["user_id"] == user_id), None)
    if latest is None:
        raise HTTPException(status_code=404, detail=f"Participant '{user_id}' was not found in session '{session_id}'.")

    return {
        "session_id": session_id,
        "participant": latest,
        "history": history,
    }


@app.post("/api/sessions/{session_id}/scores")
def post_session_score(session_id: str, payload: SessionScorePayload) -> dict:
    if payload.session_id and payload.session_id != session_id:
        raise HTTPException(status_code=400, detail="Session ID in path and payload do not match.")

    try:
        entry = store.insert_score(
            session_id=session_id,
            payload={
                "user_id": payload.user_id,
                "score": payload.score,
                "timestamp": payload.timestamp,
                "state": payload.state,
                "person_detected": payload.person_detected,
                "pose_score": payload.pose_score,
                "gaze_score": payload.gaze_score,
                "source": payload.source,
            },
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' was not found.") from exc

    return {"ok": True, "entry": entry}


@app.post("/api/attention/score")
def post_legacy_attention_score(payload: LegacyAttentionScorePayload) -> dict:
    session_id = payload.session_id or store.latest_session_id()
    if not session_id:
        raise HTTPException(status_code=400, detail="No session available. Create a session from the admin UI first.")

    return post_session_score(
        session_id,
        SessionScorePayload(
            session_id=session_id,
            user_id=payload.user_id,
            score=payload.score,
            timestamp=payload.timestamp,
            state=payload.state,
            person_detected=payload.person_detected,
            pose_score=payload.pose_score,
            gaze_score=payload.gaze_score,
            source=payload.source or "legacy-client",
        ),
    )


@app.post("/attention_score")
def post_attention_score_compat(payload: LegacyAttentionScorePayload) -> dict:
    return post_legacy_attention_score(payload)


@app.post("/api/score")
def post_score(payload: LegacyScorePayload) -> dict:
    session_id = payload.session_id or store.latest_session_id()
    if not session_id:
        raise HTTPException(status_code=400, detail="No session available. Create a session from the admin UI first.")

    return post_session_score(
        session_id,
        SessionScorePayload(
            session_id=session_id,
            user_id=payload.participant_id,
            score=payload.attention_score,
            timestamp=payload.timestamp,
            state="Attentive" if payload.attention_score >= 60 else "Distracted",
            pose_score=payload.gaze_y,
            gaze_score=payload.gaze_x,
            person_detected=True,
            source="score-api",
        ),
    )


@app.get("/api/scores")
def get_scores(session_id: str | None = Query(default=None)) -> dict:
    resolved_session_id = session_id or store.latest_session_id()
    if not resolved_session_id:
        return {"session_id": None, "participants": [], "summary": {"participant_count": 0, "total_samples": 0, "average_score": 0.0}}

    detail = store.session_detail(session_id=resolved_session_id, limit_per_user=1)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Session '{resolved_session_id}' was not found.")

    return {
        "session_id": resolved_session_id,
        "participants": detail["participants"],
        "summary": detail["summary"],
    }


@app.get("/api/metrics")
def get_metrics(session_id: str | None = Query(default=None)) -> dict:
    resolved_session_id = session_id or store.latest_session_id()
    if not resolved_session_id:
        return {
            "session_id": None,
            "timestamp": time.time(),
            "attention_percent": 0.0,
            "participant_count": 0,
            "label": "No active session",
        }

    detail = store.session_detail(session_id=resolved_session_id, limit_per_user=1)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Session '{resolved_session_id}' was not found.")

    summary = detail["summary"]
    return {
        "session_id": resolved_session_id,
        "timestamp": summary["last_updated"],
        "attention_percent": summary["average_score"],
        "participant_count": summary["participant_count"],
        "label": "Session active",
    }


@app.get("/api/attention/users")
def get_legacy_users(session_id: str | None = Query(default=None)) -> dict:
    snapshot = get_scores(session_id=session_id)
    return {
        "count": len(snapshot["participants"]),
        "users": [
            {
                "user_id": participant["user_id"],
                "score": participant["latest_score"],
                "timestamp": participant["last_seen"],
                "state": participant.get("state"),
                "source": participant.get("source"),
            }
            for participant in snapshot["participants"]
        ],
    }


@app.get("/api/attention/analytics")
def get_legacy_analytics(session_id: str | None = Query(default=None)) -> dict:
    snapshot = get_scores(session_id=session_id)
    summary = snapshot["summary"]
    scores = [participant["latest_score"] for participant in snapshot["participants"]]
    return {
        "active_users": summary["participant_count"],
        "class_average": summary["average_score"],
        "min_score": min(scores) if scores else None,
        "max_score": max(scores) if scores else None,
        "updated_at": summary["last_updated"] if summary["participant_count"] else time.time(),
    }


@app.get("/analytics/users")
def analytics_users_compat(session_id: str | None = Query(default=None)) -> dict:
    snapshot = get_scores(session_id=session_id)
    return {"count": len(snapshot["participants"]), "users": snapshot["participants"]}


@app.get("/api/attention/history/{user_id}")
def api_attention_history(
    user_id: str,
    session_id: str | None = Query(default=None),
    limit: int = Query(default=60, ge=1, le=500),
) -> dict:
    resolved_session_id = session_id or _latest_session_or_404()
    return get_participant_history(session_id=resolved_session_id, user_id=user_id, limit=limit)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)
