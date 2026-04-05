#!/usr/bin/env bash
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_ID="student-1"
CAMERA_ID="1"

# Find python
if [[ -x "$REPO_ROOT/.venv/bin/python" ]]; then
  PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
elif [[ -x "$REPO_ROOT/venv/bin/python" ]]; then
  PYTHON_BIN="$REPO_ROOT/venv/bin/python"
else
  echo "No venv found!" && exit 1
fi

cleanup() {
  echo "Shutting down..."
  kill "$BACKEND_PID" "$VITE_PID" "$ELECTRON_PID" "$CLIENT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

# 1. Start backend
echo "Starting backend..."
cd "$REPO_ROOT"
"$PYTHON_BIN" -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# 2. Start Vite only (no auto-open)
echo "Starting Vite..."
cd "$REPO_ROOT/frontend"
npx vite --host 127.0.0.1 --port 3000 &
VITE_PID=$!

# 3. Wait for Vite to be ready
echo "Waiting for Vite..."
sleep 6

# 4. Start Electron
echo "Starting Electron..."
cd "$REPO_ROOT/frontend"
npx electron . &
ELECTRON_PID=$!

# 5. Start client
echo "Starting client..."
sleep 3
cd "$REPO_ROOT"
"$PYTHON_BIN" -m clients.distributed_client \
  --user-id "$USER_ID" \
  --server-url http://127.0.0.1:8000 \
  --camera-id "$CAMERA_ID" \
  --interval 1.5 &
CLIENT_PID=$!

echo "All services running! Press Ctrl+C to stop everything."
wait
