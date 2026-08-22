@echo off
REM ====================================================================
REM Nandha LeetCode Intelligence — Windows Auto-Start Installer
REM Configures the Autopilot Server to start automatically on Windows boot
REM ====================================================================

echo ====================================================================
echo  Configuring Nandha LeetCode Autopilot Server Auto-Start
echo ====================================================================

set PROJECT_DIR=%~dp0
set VBS_SCRIPT=%PROJECT_DIR%start_autopilot_background.vbs
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\NandhaLeetCodeAutopilot.bat

echo Creating auto-start runner in Windows Startup folder...
(
    echo @echo off
    echo cd /d "%PROJECT_DIR%"
    echo wscript.exe "%VBS_SCRIPT%"
) > "%SHORTCUT_PATH%"

echo.
echo [SUCCESS] Autopilot Auto-Start Registered Successfully!
echo Path: %SHORTCUT_PATH%
echo.
echo The backend server will now start automatically whenever your computer turns on.
echo All Sunday contest phases (07:55 AM, 08:00 AM, 09:30 AM, 09:35 AM, 09:40 AM, 10:00 PM)
echo will execute 100%% automatically without opening any terminals or clicking any buttons.
echo ====================================================================
