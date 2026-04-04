# EngageX Project Details (Latest)

## What Changed

The project now uses a unified backend architecture.

- One backend app serves both host and participant frontend flows.
- Backend base URL for local development is `http://127.0.0.1:8000`.
- Frontend host route is `http://127.0.0.1:3000/host`.
- Frontend participant route is `http://127.0.0.1:3000/participant`.

## Core Runtime

- Frontend dev server: `127.0.0.1:3000`
- Unified backend: `127.0.0.1:8000` (`server.py`)
- Legacy `attention-monitor/backend/main.py` is a compatibility wrapper that imports the same backend app.

## Quick Start

### Manual

Backend:

```bash
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Optional participant score client:

```bash
python distributed_client.py --user-id student-1 --server-url http://127.0.0.1:8000 --camera-id 0 --interval 1.5
```

### Jumpstart Scripts

Windows:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-engagex-all.ps1 -CleanPorts
```

Windows with virtual camera participant mode:

```powershell
.\start-engagex-all.ps1 -UseVirtualCam -CleanPorts
```

macOS/Linux:

```bash
chmod +x ./start-engagex-all.sh
./start-engagex-all.sh
```

macOS/Linux with participant client:

```bash
./start-engagex-all.sh --with-participant
```

## API Surface (Unified Backend)

- `GET /health`
- `GET /api/metrics`
- `GET /api/attention/stream`
- `GET /api/attention/users`
- `GET /api/attention/analytics`
- `GET /api/attention/history/{user_id}`
- `GET /api/attention/distributed/stream`
- `POST /api/attention/score`
- `GET /api/scores`
- `WS /ws/scores`

Compatibility aliases:

- `POST /attention_score`
- `GET /analytics/users`

## Camera Permission Behavior

- Running backend does not request camera permissions.
- Camera permission prompt appears only when camera-consuming clients start:
  - Browser preview, or
  - Participant Python clients (`distributed_client.py` or `run_virtual_cam.py`).

## Meeting App Compatibility

If inference and meeting video are both needed on the same machine:

- Use virtual camera pipeline (`attention-monitor/client-desktop/run_virtual_cam.py`).
- Select virtual camera in Zoom/Meet/Teams.
- OBS is optional as a product dependency, but a virtual camera layer is required for simultaneous inference and meeting-video publishing.
