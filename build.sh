#!/usr/bin/env bash
set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Check if frontend directory exists
FRONTEND_DIR="frontend"
if [ ! -d "$FRONTEND_DIR" ]; then
  echo "❌ Frontend directory '$FRONTEND_DIR' not found!"
  exit 1
fi

cd "$FRONTEND_DIR"

# Check for package.json
if [ ! -f "package.json" ]; then
  echo "❌ No package.json found in $FRONTEND_DIR — is this a Node project?"
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  npm install
fi

echo "🏗️  Building frontend..."
npm run build

# Verify the build was successful
cd "$PROJECT_ROOT"
if [ -d "static" ] && [ -f "static/index.html" ]; then
  echo "✅ Frontend build complete. Static files are in ./static/"
  echo "   Files generated:"
  ls -la static/
else
  echo "❌ Build failed - no static files generated"
  echo "   Contents of static directory:"
  ls -la static/ 2>/dev/null || echo "   Static directory does not exist"
  exit 1
fi