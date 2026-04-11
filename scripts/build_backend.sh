#!/usr/bin/env bash
# scripts/build_backend.sh
# Freeze the Notebook LM backend into a standalone binary using PyInstaller.
#
# Usage: ./scripts/build_backend.sh
# Output: backend/dist/notebooklm-backend

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "==> Installing backend dependencies..."
cd "$BACKEND_DIR"
uv venv --quiet 2>/dev/null || true
uv pip install -e ".[dev]" --quiet

echo "==> Pre-downloading embedding model (all-MiniLM-L6-v2)..."
uv run python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

echo "==> Freezing backend with PyInstaller..."
uv run pyinstaller notebooklm.spec --clean --noconfirm

BINARY="$BACKEND_DIR/dist/notebooklm-backend"
if [ ! -f "$BINARY" ]; then
    echo "ERROR: Build failed — $BINARY not found"
    exit 1
fi

echo "==> Verifying binary..."
"$BINARY" --port 18999 &
BACKEND_PID=$!
sleep 5

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18999/api/healthz || echo "000")
kill "$BACKEND_PID" 2>/dev/null || true
wait "$BACKEND_PID" 2>/dev/null || true

if [ "$HEALTH" = "200" ]; then
    echo "==> Build successful: $BINARY"
    ls -lh "$BINARY"
else
    echo "ERROR: Binary health check failed (HTTP $HEALTH)"
    exit 1
fi
