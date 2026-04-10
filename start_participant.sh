#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
PYTHON_BIN="$REPO_ROOT/.venv/bin/python"

INSTALL_FRONTEND_DEPS="false"
CLEAN_PORTS="false"
VITE_PID=""
ELECTRON_PID=""

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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-frontend-deps)
      INSTALL_FRONTEND_DEPS="true"
      shift
      ;;
    --clean-ports)
      CLEAN_PORTS="true"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

cleanup() {
  [[ -n "$ELECTRON_PID" ]] && kill "$ELECTRON_PID" 2>/dev/null || true
  [[ -n "$VITE_PID" ]] && kill "$VITE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ ! -x "$PYTHON_BIN" ]]; then
  HOST_PYTHON="$(find_host_python)"
  "$HOST_PYTHON" -m venv "$REPO_ROOT/.venv"
fi

"$PYTHON_BIN" -m pip install --upgrade pip -q
"$PYTHON_BIN" -m pip install -r "$REPO_ROOT/requirements.txt" -q

if [[ "$INSTALL_FRONTEND_DEPS" == "true" || ! -d "$FRONTEND_DIR/node_modules" ]]; then
  (
    cd "$FRONTEND_DIR"
    npm install
  )
fi

if [[ ! -f "$REPO_ROOT/models/l2cs_net.onnx" || ! -f "$REPO_ROOT/models/face_landmarker.task" ]]; then
  (
    cd "$REPO_ROOT"
    "$PYTHON_BIN" "$REPO_ROOT/setup_models.py"
  )
fi

if [[ "$CLEAN_PORTS" == "true" ]]; then
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  fi
fi

(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
) &
VITE_PID=$!

for _ in {1..40}; do
  if curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
  echo "Frontend did not become ready on port 3000." >&2
  exit 1
fi

(
  cd "$FRONTEND_DIR"
  exec npm run electron
) &
ELECTRON_PID=$!

echo ""
echo "EngageX Participant is running."
echo "Frontend: http://127.0.0.1:3000"
echo "Join UI:  http://127.0.0.1:3000/participant"
echo ""
echo "Use the admin laptop's server IP and session ID in the participant UI."

wait
