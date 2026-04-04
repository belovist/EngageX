# EngageX - Real-Time Attention Monitoring System

A lightweight, CPU-oriented attention monitoring system built with YOLOv8 Nano, MediaPipe Face Mesh, L2CS-Net gaze estimation, FastAPI, and a live React dashboard.

## Project Structure

```
EngageX/
├── README.md                     # This file
├── requirements.txt              # Python dependencies
├── start-engagex-all.ps1        # Windows launcher script
├── start-engagex-all.sh         # macOS/Linux launcher script
│
├── backend/                      # FastAPI server
│   ├── __init__.py
│   └── server.py                 # Unified backend API
│
├── core/                         # ML pipeline modules
│   ├── __init__.py
│   ├── attention_monitor.py      # Main pipeline integration
│   ├── gatekeeper.py             # Stage I: YOLO person detection
│   ├── head_pose.py              # Stage II: MediaPipe head pose
│   ├── gaze_tracker.py           # Stage III: L2CS-Net gaze tracking
│   └── score_calculator.py       # Stage IV: Score fusion
│
├── clients/                      # Client applications
│   ├── __init__.py
│   ├── distributed_client.py     # Edge client for multi-device setup
│   ├── metrics_writer.py         # JSON metrics file writer
│   ├── sim_publisher.py          # Score simulator for testing
│   └── desktop/                  # Desktop virtual camera client
│       ├── __init__.py
│       ├── run_virtual_cam.py    # Virtual camera for meeting apps
│       └── ...
│
├── models/                       # ML model files (see models/README.md)
│   └── README.md
│
├── frontend/                     # React dashboard
│   └── ...
│
├── docs/                         # Documentation
│   ├── BACKEND_INTEGRATION.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PROJECT_EXPLANATION.md
│   └── project_details.md
│
├── examples/                     # Example usage scripts
│   └── example_usage.py
│
├── scripts/                      # Utility scripts
│   ├── export_l2cs_to_onnx.py
│   └── test_mp.py
│
└── legacy/                       # Deprecated implementations
    └── head_pose_opencv.py
```

## What It Does

Pipeline:

```text
Input Frame -> YOLO Gatekeeper -> Head Pose -> Gaze Tracking -> Score Calculation
```

- **Stage I**: Person detection and ROI cropping (YOLOv8 Nano)
- **Stage II**: Head pose estimation (MediaPipe Face Mesh)
- **Stage III**: Gaze estimation (L2CS-Net ONNX - optional)
- **Stage IV**: Smoothed attention scoring (EMA fusion)
- **Backend**: FastAPI server for live JSON, SSE, and WebSocket APIs
- **Frontend**: React dashboard connected to the backend in real time

## Quick Start

### Option A: Launcher Scripts (Recommended)

**Windows:**
```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-engagex-all.ps1 -CleanPorts
```

**macOS/Linux:**
```bash
chmod +x ./start-engagex-all.sh
./start-engagex-all.sh
```

### Option B: Manual Setup

#### 1. Create and activate virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

#### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

#### 3. Start the backend

```bash
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload
```

#### 4. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

#### 5. Open the dashboard

- Host view: http://127.0.0.1:3000/host
- Participant view: http://127.0.0.1:3000/participant
- Health check: http://127.0.0.1:8000/health

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/metrics` | Current metrics snapshot |
| GET | `/api/attention/stream` | SSE stream of metrics |
| GET | `/api/attention/users` | List of active users |
| GET | `/api/attention/analytics` | Class-wide analytics |
| GET | `/api/attention/history/{user_id}` | User score history |
| GET | `/api/attention/distributed/stream` | SSE for distributed mode |
| POST | `/api/attention/score` | Submit attention score |
| WS | `/ws/scores` | WebSocket for real-time scores |

## Other Modes

### JSON-only mode (no server)

Write metrics to a JSON file without running the HTTP server:

```bash
python -m clients.metrics_writer
```

### OpenCV window mode

Display local overlay window instead of the web dashboard:

```bash
python -m core.attention_monitor
```

Press `q` to quit.

### Distributed client mode (multi-device)

Run on each participant device to send scores to central backend:

```bash
python -m clients.distributed_client --user-id student-1 --server-url http://127.0.0.1:8000
```

### Virtual camera mode (for meeting apps)

Use with Zoom/Meet/Teams:

```bash
python -m clients.desktop.run_virtual_cam --camera-id 0 --show-preview
```

## Model Setup

See `models/README.md` for detailed instructions.

- **YOLOv8 Nano**: Auto-downloaded on first run
- **L2CS-Net ONNX**: Must be exported manually (optional - system degrades gracefully)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CAMERA_ID` | `0` | Camera index |
| `GAZE_MODEL_PATH` | `models/l2cs_net.onnx` | Path to gaze model |
| `ATTENTION_METRICS_PATH` | `attention_metrics.json` | Output file for metrics |

## Troubleshooting

### Uvicorn not found on Windows

Use module syntax:
```bash
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload
```

### Camera not opening

- Check camera permissions
- Try another camera index (e.g., `--camera-id 1`)
- Ensure no other app is using the webcam

### Missing gaze model

The app continues running without L2CS-Net. Attention is computed from head pose only.

### MediaPipe import error

Use a Python/MediaPipe version that supports `mp.solutions.face_mesh`.

## Documentation

- [Backend Integration](docs/BACKEND_INTEGRATION.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Project Explanation](docs/PROJECT_EXPLANATION.md)

## License

[Your license here]
