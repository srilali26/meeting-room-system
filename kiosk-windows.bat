@echo off
title Meeting Room Display Kiosk Runner
rem =========================================================================
rem Meeting Room Display Kiosk Runner for Windows Mini PC
rem Auto-restarts Microsoft Edge in Kiosk mode if closed or crashed.
rem =========================================================================

set SERVER_URL=http://192.168.50.143
set ROOM_ID=11111111-1111-1111-1111-111111111111
set TARGET_URL=%SERVER_URL%/display/%ROOM_ID%

rem Path to Edge or Chrome
set BROWSER_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist %BROWSER_PATH% (
    set BROWSER_PATH="C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
if not exist %BROWSER_PATH% (
    set BROWSER_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
)

echo Starting Display Kiosk for %TARGET_URL%...

:LOOP
echo Launching Kiosk instance...
%BROWSER_PATH% --kiosk %TARGET_URL% --edge-kiosk-type=fullscreen --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-infobars --check-for-update-interval=31536000

echo Browser closed or crashed. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto LOOP
