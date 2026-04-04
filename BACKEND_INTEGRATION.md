# Full Stack Notes

## Backend

From the project root:

```bash
pip install -r requirements.txt
cd attention-monitor/backend
python -m uvicorn main:app --host 127.0.0.1 --port 8010
```

Available endpoints:

- `GET /health`
- `GET /api/metrics`
- `GET /api/attention/stream`
- `GET /video_feed`
- `POST /api/attention/score`
- `GET /api/attention/users`
- `GET /api/attention/analytics`
- `GET /api/attention/history/{user_id}`
- `GET /api/attention/distributed/stream`

The backend writes `attention_metrics.json` on each frame.
Distributed score events are persisted in `attention_scores.db`.

### Distributed API quick examples

Submit one score event:

```bash
curl -X POST http://127.0.0.1:8010/api/attention/score \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"student-1\",\"score\":76.5,\"state\":\"Attentive\"}"
```

Get latest per-user snapshot:

```bash
curl http://127.0.0.1:8010/api/attention/users
```

Get class-level analytics:

```bash
curl http://127.0.0.1:8010/api/attention/analytics
```

### Gaze model behavior

- If `GAZE_MODEL_PATH` points to a valid `l2cs_net.onnx`, gaze is used.
- If the model is missing, the backend still runs and uses head-pose-only scoring.
- If `onnxruntime` is missing, gaze is disabled instead of crashing the whole app.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

The frontend connects to the backend through:

- `/api/attention/stream` for live SSE updates
- `/api/metrics` as a polling fallback
- `/video_feed` for the MJPEG webcam stream
- `/health` for connectivity checks

### Custom API URL

Leave `VITE_API_URL` empty to use the Vite proxy, or set it explicitly when hosting the frontend separately.

## Metrics Shape

```json
{
  "timestamp": 1730000000.0,
  "person_detected": true,
  "attention_percent": 72,
  "instantaneous_percent": 70,
  "label": "Moderately Attentive",
  "pose_score": 0.85,
  "gaze_score": 0.55,
  "smoothed_score": 0.72,
  "instantaneous_score": 0.71
}
```
