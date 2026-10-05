@echo off
echo Building and Starting Frontend in Production Mode...
echo This will serve the optimized, minified version of the React application.
cd frontend
call npm run build
call npm run preview
pause
