@echo off
echo Starting LeetCode Tracker API in Production Mode...
echo This will run with 4 workers for maximum parallel performance.
python -m uvicorn backend.main:app --workers 4 --host 0.0.0.0 --port 8000
pause
