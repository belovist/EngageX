#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
USER_ID="student-1"
CAMERA_ID="0"
WITH_PARTICIPANT="false"
WITH_VIRTUAL_CAM="false"

usage() {
  cat <<EOF
Usage: ./start-engagex-all.sh [options]

Options:
  --user-id <id>          Participant user id (default: student-1)
  --camera-id <index>     Camera index (default: 0)
  --with-participant      Start participant score client
  --with-virtual-cam      Start virtual camera participant client (implies --with-participant)
  -h, --help              Show this help
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
    --with-participant)
      WITH_PARTICIPANT="true"
      shift
      ;;
    --with-virtual-cam)
      WITH_PARTICIPANT="true"
      WITH_VIRTUAL_CAM="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python venv not found at $PYTHON_BIN" >&2
  echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi

cleanup() {
  local code=$?
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${PARTICIPANT_PID:-}" ]]; then
    kill "$PARTICIPANT_PID" >/dev/null 2>&1 || true
  fi
  exit $code
}
trap cleanup INT TERM EXIT

echo "Starting unified backend on http://127.0.0.1:8000"
cd "$REPO_ROOT"
"$PYTHON_BIN" -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

if [[ "$WITH_PARTICIPANT" == "true" ]]; then
  if [[ "$WITH_VIRTUAL_CAM" == "true" ]]; then
    echo "Starting participant virtual camera client (user=$USER_ID, camera=$CAMERA_ID)"
    "$PYTHON_BIN" -m clients.desktop.run_virtual_cam \
      --camera-id "$CAMERA_ID" \
      --backend-url http://127.0.0.1:8000 \
      --user-id "$USER_ID" \
      --show-preview &
  else
    echo "Starting participant score client (user=$USER_ID, camera=$CAMERA_ID)"
    "$PYTHON_BIN" -m clients.distributed_client \
      --user-id "$USER_ID" \
      --server-url http://127.0.0.1:8000 \
      --camera-id "$CAMERA_ID" \
      --interval 1.5 &
  fi
  PARTICIPANT_PID=$!
fi

echo "Starting frontend on http://127.0.0.1:3000/host"
cd "$REPO_ROOT/frontend"
npm run dev
