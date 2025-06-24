#!/usr/bin/env bash
set -e

# Navigate to frontend directory
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

echo "📦 Installing frontend dependencies..."
npm install

echo "🏗️  Building frontend..."
npm run build

echo "✅ Frontend build complete."
