#!/usr/bin/env bash
set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🔧 Running setup in $PROJECT_ROOT"

# Check for requirements.txt
if [ ! -f "requirements.txt" ]; then
  echo "❌ requirements.txt not found. Are you in the right directory?"
  exit 1
fi

# Create virtual environment if not exists
if [ ! -d "venv" ]; then
  echo "🐍 Creating Python virtual environment..."
  python3 -m venv venv
else
  echo "✅ Virtual environment already exists."
fi

# Activate the virtual environment
echo "⚙️  Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install backend requirements
echo "📦 Installing Python dependencies from requirements.txt..."
pip install -r requirements.txt

# Create necessary directories
echo "📁 Creating project directories..."
mkdir -p logs
mkdir -p captures
mkdir -p projects
mkdir -p static

echo "✅ Backend setup complete."

# Setup frontend
FRONTEND_DIR="frontend"
if [ -d "$FRONTEND_DIR" ]; then
  echo "🌐 Setting up frontend..."
  cd "$FRONTEND_DIR"
  
  # Check for package.json
  if [ ! -f "package.json" ]; then
    echo "❌ No package.json found in $FRONTEND_DIR"
    exit 1
  fi
  
  # Install frontend dependencies
  echo "📦 Installing frontend dependencies..."
  npm install
  
  cd "$PROJECT_ROOT"
  echo "✅ Frontend setup complete."
else
  echo "⚠️  Frontend directory not found, skipping frontend setup"
fi

echo "🎉 Setup complete! Run ./start.sh to start the server."