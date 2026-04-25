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

:: Open browser after a short delay (runs in background)
start "" cmd /c "timeout /t 2 >nul && start http://localhost:5000"

:: Start the app
.venv\Scripts\python app.py
