#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

USER_ID="student-1"
CAMERA_ID="0"

PYTHON_BIN=""
BACKEND_PID=""
VITE_PID=""
ELECTRON_PID=""
CLIENT_PID=""

echo "🚀 Starting EngageX..."

# ---------- PYTHON SETUP ----------

find_python() {
  if [[ -x "$REPO_ROOT/.venv/bin/python" ]]; then
    echo "$REPO_ROOT/.venv/bin/python"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi
  if command -v python >/dev/null 2>&1; then
    echo "python"
    return
  fi
  echo "❌ Python not found" >&2
  exit 1
}

PYTHON_BIN="$(find_python)"

# Create venv if needed
if [[ ! -d "$REPO_ROOT/.venv" ]]; then
  echo "📦 Creating virtual environment..."
  "$PYTHON_BIN" -m venv "$REPO_ROOT/.venv"
fi

PYTHON_BIN="$REPO_ROOT/.venv/bin/python"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
"$PYTHON_BIN" -m pip install --upgrade pip -q
"$PYTHON_BIN" -m pip install -r "$REPO_ROOT/requirements.txt" -q

# ---------- FRONTEND ----------

if [[ ! -d "$REPO_ROOT/frontend/node_modules" ]]; then
  echo "📦 Installing frontend dependencies..."
  cd "$REPO_ROOT/frontend"
  npm install
  cd "$REPO_ROOT"
fi

# ---------- MODELS ----------

if [[ ! -f "$REPO_ROOT/models/l2cs_net.onnx" ]]; then
  echo "📥 Downloading models..."
  "$PYTHON_BIN" "$REPO_ROOT/setup_models.py"
fi

# ---------- CLEAN PORTS ----------

echo "🧹 Clearing ports..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
sleep 1

# ---------- CLEANUP ----------

cleanup() {
  echo "🛑 Stopping all services..."
  [[ -n "$CLIENT_PID" ]] && kill "$CLIENT_PID" 2>/dev/null || true
  [[ -n "$ELECTRON_PID" ]] && kill "$ELECTRON_PID" 2>/dev/null || true
  [[ -n "$VITE_PID" ]] && kill "$VITE_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ---------- START BACKEND ----------

echo "🧠 Starting backend..."
cd "$REPO_ROOT"
"$PYTHON_BIN" -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
sleep 3

# ---------- START FRONTEND ----------

echo "🌐 Starting Vite..."
cd "$REPO_ROOT/frontend"
npx vite --host 127.0.0.1 --port 3000 --strictPort &
VITE_PID=$!

# Wait for Vite to be ready
echo "⏳ Waiting for Vite..."
for i in {1..20}; do
  if curl -s http://127.0.0.1:3000 >/dev/null 2>&1; then
    echo "✅ Vite ready!"
    break
  fi
  sleep 1
done

# ---------- START ELECTRON ----------

echo "🖥️ Starting Electron..."
cd "$REPO_ROOT/frontend"
npx electron . &
ELECTRON_PID=$!
sleep 3

# ---------- START CLIENT ----------

echo "🎥 Starting AI client..."
cd "$REPO_ROOT"
"$PYTHON_BIN" -m clients.distributed_client \
  --user-id "$USER_ID" \
  --server-url http://127.0.0.1:8000 \
  --camera-id "$CAMERA_ID" \
  --interval 1.5 &
CLIENT_PID=$!

echo ""
echo "✅ EngageX is running!"
echo "   Backend:  http://127.0.0.1:8000"
echo "   Frontend: http://127.0.0.1:3000"
echo ""
echo "Press Ctrl+C to stop everything."
echo ""

wait
