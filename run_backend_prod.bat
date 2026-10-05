@echo off
echo Starting FastAPI Backend in Production Mode with 4 workers...
echo This will significantly increase the speed of the backend by handling multiple requests concurrently.
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 4
pause
