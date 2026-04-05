#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_ID="student-1"
CAMERA_ID="0"
USE_VIRTUAL_CAM="false"
INSTALL_FRONTEND_DEPS="false"
CLEAN_PORTS="false"

PYTHON_BIN=""
BACKEND_PID=""
VITE_PID=""
ELECTRON_PID=""
CLIENT_PID=""

usage() {
  cat <<EOF
Usage: ./start.sh [options]

Options:
  --user-id <id>              Participant user id (default: student-1)
  --camera-id <index>         Camera index (default: 0)
  --use-virtual-cam           Start the virtual camera participant client
  --install-frontend-deps     Force npm install before startup
  --clean-ports               Stop listeners on ports 3000 and 8000 before startup
  -h, --help                  Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user-id)
      USER_ID="${2:-}"
      shift 2
      ;;
    --camera-id)
      CAMERA_ID="${2:-}"
      shift 2
      ;;
    --use-virtual-cam)
      USE_VIRTUAL_CAM="true"
      shift
      ;;
    --install-frontend-deps)
      INSTALL_FRONTEND_DEPS="true"
      shift
      ;;
    --clean-ports)
      CLEAN_PORTS="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

find_existing_python() {
  local candidates=(
    "$REPO_ROOT/.venv/bin/python"
    "$REPO_ROOT/venv/bin/python"
    "$REPO_ROOT/.venv/Scripts/python.exe"
    "$REPO_ROOT/venv/Scripts/python.exe"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

find_host_python() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s\n' "python3"
    return 0
  fi

  if command -v python >/dev/null 2>&1; then
    printf '%s\n' "python"
    return 0
  fi

  return 1
}

ensure_python() {
  PYTHON_BIN="$(find_existing_python || true)"
  if [[ -n "$PYTHON_BIN" ]]; then
    echo "Found virtual environment"
    return 0
  fi

  local host_python
  host_python="$(find_host_python || true)"
  if [[ -z "$host_python" ]]; then
    echo "ERROR: Python was not found. Install Python 3 and try again." >&2
    exit 1
  fi

  echo "Creating virtual environment..."
  "$host_python" -m venv "$REPO_ROOT/.venv"

  PYTHON_BIN="$(find_existing_python || true)"
  if [[ -z "$PYTHON_BIN" ]]; then
    echo "ERROR: Failed to create a usable virtual environment." >&2
    exit 1
  fi

  echo "Installing Python dependencies..."
  "$PYTHON_BIN" -m pip install --upgrade pip
  "$PYTHON_BIN" -m pip install -r "$REPO_ROOT/requirements.txt"
}

ensure_frontend_deps() {
  if [[ "$INSTALL_FRONTEND_DEPS" != "true" && -d "$REPO_ROOT/frontend/node_modules" ]]; then
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm was not found. Install Node.js and try again." >&2
    exit 1
  fi

  echo "Installing frontend dependencies..."
  (
    cd "$REPO_ROOT/frontend"
    npm install
  )
}

ensure_models() {
  if [[ -f "$REPO_ROOT/models/l2cs_net.onnx" && -f "$REPO_ROOT/models/face_landmarker.task" ]]; then
    echo "Models ready"
    return 0
  fi

  echo "Models missing, running setup_models.py..."
  (
    cd "$REPO_ROOT"
    "$PYTHON_BIN" "$REPO_ROOT/setup_models.py"
  )

  if [[ ! -f "$REPO_ROOT/models/l2cs_net.onnx" || ! -f "$REPO_ROOT/models/face_landmarker.task" ]]; then
    echo "ERROR: Model setup failed. Run ./setup_models.sh and verify both model files exist." >&2
    exit 1
  fi

  echo "Models ready"
}

stop_process_on_port() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "Stopping processes on port $port"
      kill $pids 2>/dev/null || true
      sleep 1
    fi
    return 0
  fi

  if command -v fuser >/dev/null 2>&1; then
    echo "Stopping processes on port $port"
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
}

wait_for_backend() {
  local attempt
  for attempt in $(seq 1 30); do
    if "$PYTHON_BIN" - <<'PY'
import json
import sys
import urllib.request

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2) as response:
        payload = json.load(response)
    sys.exit(0 if payload.get("status") == "ok" else 1)
except Exception:
    sys.exit(1)
PY
    then
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_frontend() {
  local attempt
  for attempt in $(seq 1 40); do
    if "$PYTHON_BIN" - <<'PY'
import sys
import urllib.request

try:
    with urllib.request.urlopen("http://127.0.0.1:3000", timeout=2) as response:
        sys.exit(0 if getattr(response, "status", 0) == 200 else 1)
except Exception:
    sys.exit(1)
PY
    then
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_stack() {
  local attempt
  for attempt in $(seq 1 40); do
    if "$PYTHON_BIN" - <<'PY'
import json
import sys
import urllib.request

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2) as response:
        health = json.load(response)
    with urllib.request.urlopen("http://127.0.0.1:8000/api/scores", timeout=2) as response:
        scores = json.load(response)
    participants = scores.get("participants") or []
    ready = health.get("status") == "ok" and health.get("video_feed_live") and len(participants) > 0
    sys.exit(0 if ready else 1)
except Exception:
    sys.exit(1)
PY
    then
      return 0
    fi
    sleep 1
  done

  return 1
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM

  if [[ -n "$CLIENT_PID" ]]; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$ELECTRON_PID" ]]; then
    kill "$ELECTRON_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$VITE_PID" ]]; then
    kill "$VITE_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  exit "$code"
}

trap cleanup EXIT INT TERM

echo "Starting EngageX..."
ensure_python
ensure_frontend_deps
ensure_models

if [[ "$CLEAN_PORTS" == "true" ]]; then
  stop_process_on_port 3000
  stop_process_on_port 8000
fi

echo "Starting backend..."
(
  cd "$REPO_ROOT"
  exec "$PYTHON_BIN" -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload
) &
BACKEND_PID=$!

if ! wait_for_backend; then
  echo "ERROR: Backend did not become ready on http://127.0.0.1:8000" >&2
  exit 1
fi

echo "Starting Vite..."
(
  cd "$REPO_ROOT/frontend"
  exec npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
) &
VITE_PID=$!

if ! wait_for_frontend; then
  echo "ERROR: Frontend did not become ready on http://127.0.0.1:3000" >&2
  exit 1
fi

echo "Starting Electron..."
(
  cd "$REPO_ROOT/frontend"
  exec npm run electron
) &
ELECTRON_PID=$!

sleep 3

if [[ "$USE_VIRTUAL_CAM" == "true" ]]; then
  echo "Starting participant virtual camera client..."
  (
    cd "$REPO_ROOT"
    exec "$PYTHON_BIN" -m clients.desktop.run_virtual_cam \
      --camera-id "$CAMERA_ID" \
      --backend-url http://127.0.0.1:8000 \
      --user-id "$USER_ID" \
      --show-preview
  ) &
else
  echo "Starting participant client..."
  (
    cd "$REPO_ROOT"
    exec "$PYTHON_BIN" -m clients.distributed_client \
      --user-id "$USER_ID" \
      --server-url http://127.0.0.1:8000 \
      --camera-id "$CAMERA_ID" \
      --interval 1.5
  ) &
fi
CLIENT_PID=$!

echo "Validating live stack..."
if ! wait_for_stack; then
  echo "ERROR: Backend, frontend, and live model feed did not all become ready." >&2
  echo "Make sure the camera is free and the participant client can stream frames." >&2
  exit 1
fi

echo
echo "EngageX is running"
echo "Backend:   http://127.0.0.1:8000"
echo "Frontend:  http://127.0.0.1:3000"
echo "Host view: http://127.0.0.1:3000/host"
echo
echo "Press Ctrl+C to stop everything."

wait
