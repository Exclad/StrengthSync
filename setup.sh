#!/bin/bash
echo "StrengthSync — First-time setup"
echo "================================="
echo

# Check Python is installed
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 not found."
    echo "Install it from https://www.python.org/downloads/"
    echo "  macOS shortcut: brew install python3"
    exit 1
fi

echo "Python found: $(python3 --version)"
echo

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv .venv
echo "Done."
echo

# Install dependencies
echo "Installing dependencies..."
.venv/bin/pip install -r requirements.txt

echo
echo "================================="
echo "Setup complete!"
echo "Run ./start.sh to launch the app."
echo "================================="
