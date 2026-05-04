@echo off
echo StrengthSync — Starting app...
echo.

:: Check setup has been run
if not exist .venv\Scripts\python.exe (
    echo ERROR: Virtual environment not found.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

:: Start the app — it will open your browser automatically on the correct port
.venv\Scripts\python app.py
