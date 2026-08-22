' Nandha LeetCode Intelligence — Silent Background Autopilot Launcher
' Starts FastAPI backend server in hidden background mode (no popup window)

Set WshShell = CreateObject("WScript.Shell")
strCurrentDir = WshShell.CurrentDirectory

' Launch FastAPI backend in background on port 8000
WshShell.Run "cmd.exe /c python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000", 0, False
