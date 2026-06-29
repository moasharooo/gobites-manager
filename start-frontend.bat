@echo off
echo ========================================
echo   GoBites Manager - Starting Frontend
echo ========================================
cd /d "%~dp0frontend"
echo Starting React dev server on http://localhost:5173
echo.
npm run dev
pause
