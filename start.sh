#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"
if [ ! -d "venv" ]; then
  echo "❌ Virtual environment not found — please run setup.sh first."
  exit 1
fi

echo "Activating Python virtual environment..."
# shellcheck disable=SC1091
source venv/bin/activate

echo "Starting the server..."
# Modify the line below according to how the server is launched:
# For FastAPI via uvicorn:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or if the entrypoint is different, replace the above with:
# python run.py
