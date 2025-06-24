#!/usr/bin/env bash
set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
  echo "❌ Virtual environment not found — please run ./setup.sh first."
  exit 1
fi

echo "🐍 Activating Python virtual environment..."
source venv/bin/activate

# Check if static files exist for production mode
if [ -d "static" ] && [ "$(ls -A static)" ]; then
  echo "✅ Static files found - running in production mode"
  MODE="production"
else
  echo "⚠️  No static files found - running in development mode"
  echo "   Run ./build.sh to build frontend for production"
  MODE="development"
fi

# Create necessary directories if they don't exist
mkdir -p logs
mkdir -p captures
mkdir -p projects

echo "🚀 Starting the server..."

# Start the FastAPI server
if [ "$MODE" = "development" ]; then
  echo "   Access the API at: http://localhost:8000/api"
  echo "   For frontend development, run 'cd frontend && npm run dev' in another terminal"
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
else
  echo "   Access the application at: http://localhost:8000"
  uvicorn app.main:app --host 0.0.0.0 --port 8000
fi