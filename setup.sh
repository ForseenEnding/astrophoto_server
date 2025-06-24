#!/usr/bin/env bash
set -e

# Assumes you're already in the astrophoto_server directory
echo "🔧 Running setup in $(pwd)"

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
# shellcheck disable=SC1091
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install backend requirements
echo "📦 Installing Python dependencies from requirements.txt..."
pip install -r requirements.txt

echo "✅ Backend setup complete."
