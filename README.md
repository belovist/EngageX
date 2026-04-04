# Real-Time Attention Monitoring System

A lightweight, CPU-oriented attention monitoring system built with YOLOv8 Nano, MediaPipe Face Mesh, L2CS-Net gaze estimation, FastAPI, and a live React dashboard.

## What It Does

Pipeline:

```text
Input Frame -> YOLO Gatekeeper -> Head Pose -> Gaze Tracking -> Score Calculation
```

- Stage I: person detection and ROI cropping
- Stage II: head pose estimation
- Stage III: gaze estimation when the ONNX model is available
- Stage IV: smoothed attention scoring
- Optional FastAPI server for live JSON, SSE, and MJPEG video
- React dashboard connected to the backend in real time

## Run It

### 1. Install Python dependencies

From the project root:

```bash
pip install -r requirements.txt
```

### 2. Start the backend

```bash
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Backend endpoints:

- `GET /health`
- `GET /api/metrics`
- `GET /api/attention/stream`
- `GET /video_feed`
- `POST /api/attention/score`
- `GET /api/attention/users`
- `GET /api/attention/analytics`
- `GET /api/attention/history/{user_id}`
- `GET /api/attention/distributed/stream`

The backend also writes `attention_metrics.json` on each frame.
It also logs distributed score events in `attention_scores.db`.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

The Vite dev server proxies `/api`, `/video_feed`, and `/health` to `http://127.0.0.1:8000`.

## Other Modes

### JSON-only mode

If you only want the metrics file:

```bash
python metrics_writer.py
```

### OpenCV window mode

If you want the local overlay window instead of the dashboard:

```bash
python attention_monitor.py
```

Press `q` to quit.

### Distributed client mode (multi-device)

Run this script on each participant device:

```bash
python distributed_client.py --user-id student-1 --server-url http://127.0.0.1:8000
```

This sends only score events (no video) every 1-2 seconds:

```json
{
	"user_id": "student-1",
	"score": 74.0,
	"timestamp": 1730000000.0,
	"state": "Attentive",
	"pose_score": 0.82,
	"gaze_score": 0.67,
	"source": "edge-client"
}
```

## Optional Environment Variables

- `CAMERA_ID=0`
- `GAZE_MODEL_PATH=l2cs_net.onnx`
- `ATTENTION_METRICS_PATH=attention_metrics.json`

If `GAZE_MODEL_PATH` is missing, the system still runs and falls back to head-pose-only scoring.

## Frontend Notes

- Live status uses SSE with polling fallback.
- The webcam panel uses the MJPEG backend stream.
- Set `VITE_API_URL` only if the backend is not running on localhost:8000.

## Troubleshooting

### Uvicorn not found on Windows

Use:

```bash
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

### Camera not opening

- Check camera permissions.
- Try another camera index such as `1` or `2`.
- Make sure another app is not already using the webcam.

### Missing ONNX runtime or model

The app keeps running without the L2CS gaze model. In that case gaze is disabled and attention is computed from head pose only.

### MediaPipe solutions error

If you hit a MediaPipe `solutions` import error, use a Python / MediaPipe combination that still supports `mp.solutions.face_mesh` as required by this codebase.

## Files

```text
attention_monitor.py    Main OpenCV pipeline
metrics_writer.py       JSON-only writer
server.py               FastAPI + SSE + MJPEG
distributed_client.py   Edge client that posts scores to central backend
gatekeeper.py           YOLO person detection
head_pose.py            MediaPipe head pose estimation
gaze_tracker.py         Optional ONNX gaze estimation
score_calculator.py     Attention score fusion
frontend/               React dashboard
```
