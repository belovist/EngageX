#!/usr/bin/env bash
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_ID="student-1"
CAMERA_ID="1"

# Find python - handle both Windows (Scripts) and Mac/Linux (bin)
if [[ -x "$REPO_ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON_BIN="$REPO_ROOT/.venv/Scripts/python.exe"
  PIP_BIN="$REPO_ROOT/.venv/Scripts/pip.exe"
elif [[ -x "$REPO_ROOT/.venv/bin/python" ]]; then
  PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
  PIP_BIN="$REPO_ROOT/.venv/bin/pip"
elif [[ -x "$REPO_ROOT/venv/Scripts/python.exe" ]]; then
  PYTHON_BIN="$REPO_ROOT/venv/Scripts/python.exe"
  PIP_BIN="$REPO_ROOT/venv/Scripts/pip.exe"
elif [[ -x "$REPO_ROOT/venv/bin/python" ]]; then
  PYTHON_BIN="$REPO_ROOT/venv/bin/python"
  PIP_BIN="$REPO_ROOT/venv/bin/pip"
else
  echo "No venv found, creating one..."
  python3 -m venv "$REPO_ROOT/.venv" 2>/dev/null || python -m venv "$REPO_ROOT/.venv"
  # Detect pip location after creation
  if [[ -x "$REPO_ROOT/.venv/Scripts/pip.exe" ]]; then
    PIP_BIN="$REPO_ROOT/.venv/Scripts/pip.exe"
    PYTHON_BIN="$REPO_ROOT/.venv/Scripts/python.exe"
  else
    PIP_BIN="$REPO_ROOT/.venv/bin/pip"
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
  fi
  "$PIP_BIN" install --upgrade pip
  "$PIP_BIN" install -r "$REPO_ROOT/requirements.txt"
  echo "✅ venv created and dependencies installed"
fi

# Check models
if [[ ! -f "$REPO_ROOT/models/l2cs_net.onnx" ]]; then
  echo "Model not found, running setup_models.py..."
  "$PYTHON_BIN" "$REPO_ROOT/setup_models.py"
fi

# Check frontend dependencies
if [[ ! -d "$REPO_ROOT/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  cd "$REPO_ROOT/frontend"
  npm install
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

# 2. Kill anything on port 3000 and start Vite
echo "Starting Vite..."
cd "$REPO_ROOT/frontend"
# Kill anything on port 3000 first
npx kill-port 3000 2>/dev/null || true
npx vite --host 127.0.0.1 --port 3000 --strictPort &
VITE_PID=$!

# 3. Wait for Vite
echo "Waiting for Vite..."
sleep 8

# 4. Start Electron
echo "Starting Electron..."
cd "$REPO_ROOT/frontend"
npx electron . &
ELECTRON_PID=$!

# 5. Start client
sleep 3
echo "Starting client..."
cd "$REPO_ROOT"
"$PYTHON_BIN" -m clients.distributed_client \
  --user-id "$USER_ID" \
  --server-url http://127.0.0.1:8000 \
  --camera-id "$CAMERA_ID" \
  --interval 1.5 &
CLIENT_PID=$!

echo "✅ All services running! Press Ctrl+C to stop everything."
wait
