import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from database import Database


db = Database()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = app
    yield
    db.close()


app = FastAPI(title="Attention Monitor Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AttentionScoreIn(BaseModel):
    user_id: str = Field(..., min_length=1)
    score: float = Field(..., ge=0.0, le=100.0)
    timestamp: float
    state: str | None = None
    source: str | None = "client"


@app.get("/health")
def health():
    return {"status": "ok", "service": "attention-monitor-backend"}


def _build_analytics(users: list[dict]) -> dict:
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


@app.post("/attention_score")
def post_attention_score(payload: AttentionScoreIn):
    row = payload.model_dump()
    db.insert_score(row)
    users = db.latest_users()
    return {"ok": True, "entry": row, "analytics": _build_analytics(users)}


@app.post("/api/attention/score")
def post_attention_score_api(payload: AttentionScoreIn):
    return post_attention_score(payload)


@app.get("/analytics/users")
def analytics_users():
    users = db.latest_users()
    return {"count": len(users), "users": users}


@app.get("/api/attention/users")
def api_attention_users():
    return analytics_users()


@app.get("/api/attention/analytics")
def api_attention_analytics():
    users = db.latest_users()
    return _build_analytics(users)


@app.get("/api/attention/history/{user_id}")
def api_attention_history(user_id: str, limit: int = Query(default=100, ge=1, le=5000)):
    history = db.user_history(user_id=user_id, limit=limit)
    return {"user_id": user_id, "count": len(history), "history": history}


@app.get("/api/attention/distributed/stream")
async def api_distributed_stream():
    async def event_gen():
        while True:
            users = db.latest_users()
            payload = {
                "users": users,
                "analytics": _build_analytics(users),
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
