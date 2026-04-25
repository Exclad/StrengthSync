#!/bin/bash
echo "StrengthSync — Starting app..."
echo

# Check setup has been run
if [ ! -f ".venv/bin/python" ]; then
    echo "ERROR: Virtual environment not found."
    echo "Please run ./setup.sh first."
    exit 1
fi

# Open browser after a short delay (background)
(sleep 2 && open "http://localhost:5000" 2>/dev/null || xdg-open "http://localhost:5000" 2>/dev/null) &

# Start the app
.venv/bin/python app.py
