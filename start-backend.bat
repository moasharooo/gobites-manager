@echo off
echo ========================================
echo   GoBites Manager - Starting Backend
echo ========================================
cd /d "%~dp0backend"
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting FastAPI server on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
