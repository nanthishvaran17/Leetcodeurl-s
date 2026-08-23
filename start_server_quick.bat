@echo off
REM ====================================================================
REM 🏛️ NANDHA ENGINEERING COLLEGE — 1-CLICK QUICK SERVER LAUNCHER & RESTARTER (24/7)
REM ====================================================================

title Nandha LeetCode Intelligence Platform — 24/7 Server Runner

echo ====================================================================
echo  Starting Nandha LeetCode 24/7 Server & Sunday Autopilot Engine...
echo ====================================================================

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo [1/4] Checking and freeing port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Freeing process %%a on port 8000...
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/4] Initializing Database & Roster State...
python backend/scripts/generate_canonical_roster.py

echo [3/4] Starting FastAPI Backend on http://127.0.0.1:8000 with Sunday Autopilot...
start "Nandha-Backend-8000" cmd /k "title Nandha Backend API & python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo [4/4] Starting Frontend Dev Server on http://localhost:3000...
start "Nandha-Frontend-3000" cmd /k "title Nandha Frontend UI & cd frontend && npm run dev"

echo.
echo ====================================================================
echo [SUCCESS] Backend & Frontend Servers Launched Successfully!
echo.
echo  - Backend API: http://127.0.0.1:8000
echo  - Health Check: http://127.0.0.1:8000/health
echo  - Frontend Portal: http://localhost:3000
echo  - Live Cloud Hosting: https://leetcode-student-data.web.app
echo ====================================================================
timeout /t 5 >nul
