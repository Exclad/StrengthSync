#!/bin/bash
echo "StrengthSync — Starting app..."
echo

# Check setup has been run
if [ ! -f ".venv/bin/python" ]; then
    echo "ERROR: Virtual environment not found."
    echo "Please run ./setup.sh first."
    exit 1
fi

# Start the app — it will open your browser automatically on the correct port
.venv/bin/python app.py
