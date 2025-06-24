#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/ForseenEnding/astrophoto_server.git"
FOLDER="astrophoto_server"

echo "Cloning repository..."
if [ ! -d "$FOLDER" ]; then
  git clone "$REPO_URL" "$FOLDER"
else
  echo "✅ $FOLDER already exists, pulling latest..."
  cd "$FOLDER" && git pull && cd ..
fi

cd "$FOLDER"

echo "Checking for requirements.txt..."
if [ ! -f "requirements.txt" ]; then
  echo "❌ requirements.txt not found—please verify the repo structure."
  exit 1
fi

echo "Creating Python virtual environment..."
python3 -m venv venv

echo "Activating venv and upgrading pip..."
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "✅ Setup complete. To activate the environment, run:"
echo "    source $(pwd)/venv/bin/activate"
