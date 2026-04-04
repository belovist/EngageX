# Backend + Frontend Integration (Unified)

## Latest Runtime Contract

- Frontend: `http://127.0.0.1:3000`
- Host UI entry route: `http://127.0.0.1:3000/host`
- Participant UI entry route: `http://127.0.0.1:3000/participant`
- Unified backend: `http://127.0.0.1:8000` (single server from `server.py`)

There is no split backend requirement anymore for host vs participant routes.
`attention-monitor/backend/main.py` now points to the same unified app.

## Startup Options

### Option A: Manual terminals

Terminal 1 (backend):

```bash
pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2 (frontend):

```bash
cd frontend
npm install
npm run dev
```

Terminal 3 (optional participant score client):

```bash
python distributed_client.py --user-id student-1 --server-url http://127.0.0.1:8000 --camera-id 0 --interval 1.5
```

### Option B: Jumpstart scripts

Windows:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-engagex-all.ps1 -CleanPorts
```

Windows (virtual camera mode):

```powershell
.\start-engagex-all.ps1 -UseVirtualCam -CleanPorts
```

macOS/Linux:

```bash
chmod +x ./start-engagex-all.sh
./start-engagex-all.sh
```

macOS/Linux with participant pipeline:

```bash
./start-engagex-all.sh --with-participant
```

## Unified Backend Endpoints (8000)

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
- `GET /video_feed` (compatibility placeholder feed)

Compatibility aliases retained:

- `POST /attention_score`
- `GET /analytics/users`

## Frontend to Backend Mapping

Vite proxy maps to backend `:8000`:

- `/api` -> `http://127.0.0.1:8000`
- `/ws` -> `ws://127.0.0.1:8000`
- `/video_feed` -> `http://127.0.0.1:8000`
- `/health` -> `http://127.0.0.1:8000`

Default frontend dev open route is `/host`.

## Camera Permissions and Meeting Apps

Important behavior:

- Starting backend does not trigger camera permission prompts.
- Camera permissions are requested only when a camera consumer starts (browser preview or Python participant client).

Conflict rule:

- Only one process should own a physical webcam at once.
- If Python inference is active, browser preview can fail with camera-in-use errors.

Meeting-app compatible path:

- Use `clients/desktop/run_virtual_cam.py`.
- Select virtual camera in Zoom/Meet/Teams.
- OBS is optional as a product dependency, but a virtual camera layer is required for simultaneous inference + meeting video.
