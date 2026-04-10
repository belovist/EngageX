# EngageX

EngageX is a LAN-first attention monitoring system for classroom or meeting setups.

One laptop runs the admin backend and dashboard. Participant laptops connect over the same Wi-Fi, run local attention inference, and send lightweight JSON scores back to the admin laptop. Participant laptops can also publish a virtual camera feed for Zoom, Meet, Teams, or OBS.

## What Works

- Admin dashboard for session creation and live monitoring
- Participant desktop client for LAN score publishing
- Participant virtual camera mode for meeting apps
- Session history stored in SQLite
- Delete old sessions from the admin dashboard
- Live multi-participant trend graph on the admin dashboard
- Sustained low-attention alerts when a participant stays below 25% for 5 minutes
- Head-pose-only fallback when the gaze model is missing

## Project Layout

```text
pbl/
|- backend/
|  `- server.py
|- clients/
|  |- distributed_client.py
|  `- desktop/
|     |- run_virtual_cam.py
|     `- virtual_cam_output.py
|- core/
|  |- attention_monitor.py
|  |- gatekeeper.py
|  |- head_pose.py
|  |- gaze_tracker.py
|  `- score_calculator.py
|- frontend/
|  |- electron/
|  `- src/
|- models/
|- start.ps1
|- start.sh
|- start_participant.ps1
|- start_participant.sh
`- requirements.txt
```

## Main Flows

### Admin laptop

Starts:

- FastAPI backend on port `8000`
- Vite frontend on port `3000`
- Electron desktop window for the admin dashboard

Windows:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-engagex-all.ps1 -CleanPorts
```

You can also run:

```powershell
.\start.ps1 -CleanPorts
```

macOS/Linux:

```bash
chmod +x ./start-engagex-all.sh
./start-engagex-all.sh --clean-ports
```

### Participant laptop

Starts:

- Vite frontend on port `3000`
- Electron desktop window for the participant app

Windows:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start_participant.ps1 -CleanPorts
```

macOS/Linux:

```bash
chmod +x ./start_participant.sh
./start_participant.sh --clean-ports
```

In the participant app:

1. Enter the admin laptop server IP.
2. Enter the session ID.
3. Enter the participant user ID.
4. Choose one of these modes:

- `Start Local Client`
  Sends attention scores over the LAN.
- `Start Virtual Camera`
  Runs the attention pipeline and publishes a virtual camera feed for meeting apps.

Use `Stop Running Mode` before switching between these modes.

## Admin Dashboard Features

- Create or refresh a session from a meeting link
- View recent sessions
- Delete previous sessions directly from the dashboard
- See all participant rows with latest score, average, samples, and last-seen time
- See a multi-line graph of all participant score trends
- See sustained low-attention alert cards

### Low-attention alerts

An alert is raised when:

- The participant's latest continuous score streak stays below `25%`
- That low streak lasts at least `5 minutes`
- The participant is still actively sending recent samples

These alerts appear on the admin dashboard and are also reflected in the participant table.

## Virtual Camera Mode

The participant-side virtual camera mode runs:

```bash
python -m clients.desktop.run_virtual_cam
```

The desktop app now starts this for you from the participant UI, but you can still run it manually if needed:

```powershell
.\.venv\Scripts\python.exe -m clients.desktop.run_virtual_cam `
  --session-id SES-XXXXXXXXXX `
  --user-id student-1 `
  --backend-url http://192.168.0.25:8000 `
  --camera-id 0 `
  --show-preview
```

After virtual camera mode starts:

1. Open Zoom, Meet, Teams, or OBS.
2. Select the virtual camera device exposed on the participant laptop.
3. Keep the EngageX participant process running.

Do not run `Start Local Client` and `Start Virtual Camera` at the same time on the same participant laptop.

## Manual Setup

### 1. Create a virtual environment

```bash
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\activate
```

macOS/Linux:

```bash
source .venv/bin/activate
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

This includes:

- OpenCV
- MediaPipe
- ONNX Runtime
- Ultralytics
- FastAPI
- pyvirtualcam

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Run manually

Backend:

```bash
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Electron desktop window:

```bash
cd frontend
npm run electron
```

## Models

Expected model files:

- `yolov8n.pt`
- `models/face_landmarker.task`
- `models/l2cs_net.onnx`

Notes:

- `yolov8n.pt` is used for person detection.
- `face_landmarker.task` is used by the head-pose path.
- `l2cs_net.onnx` enables gaze tracking.
- If `l2cs_net.onnx` is missing, the system still runs with head-pose-only scoring.

## API Surface

### Core

- `GET /health`
- `GET /api/system/info`
- `GET /api/metrics`
- `GET /api/scores`

### Admin

- `GET /api/admin/sessions`
- `POST /api/admin/session`
- `DELETE /api/admin/sessions/{session_id}`

### Session detail

- `GET /api/sessions/{session_id}`
- `GET /api/sessions/{session_id}/participants`
- `GET /api/sessions/{session_id}/participants/{user_id}`
- `POST /api/sessions/{session_id}/scores`

### Compatibility endpoints

- `POST /api/attention/score`
- `POST /attention_score`
- `POST /api/score`
- `GET /api/attention/users`
- `GET /api/attention/analytics`
- `GET /api/attention/history/{user_id}`
- `GET /analytics/users`

## Troubleshooting

### Camera does not open

- Close Zoom, Meet, Teams, OBS, or any browser tab that is already using the webcam.
- Try another camera index.
- On Windows, allow camera access in system privacy settings.

### Virtual camera does not show up in the meeting app

- Start the EngageX virtual camera first.
- Then reopen Zoom, Meet, Teams, or OBS.
- Make sure `pyvirtualcam` is installed in the participant laptop's `.venv`.

### Participant can reach the UI but cannot send data

- Confirm the admin laptop backend is running on port `8000`.
- Confirm both laptops are on the same Wi-Fi.
- Confirm Windows Firewall allows the admin backend on port `8000`.

### Gaze model is missing

The system still works. Gaze-based scoring is disabled and attention falls back to the head-pose path.

## Verification Notes

The current codebase has been smoke-checked for:

- frontend production build
- backend Python syntax
- distributed client CLI entrypoint
- virtual camera CLI entrypoint
- gaze, gatekeeper, and attention-monitor model loading
- session create, score insert, alert generation, and session delete logic against a temporary backend store

## Related Docs

- [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- [docs/PROJECT_EXPLANATION.md](docs/PROJECT_EXPLANATION.md)
- [docs/project_details.md](docs/project_details.md)
