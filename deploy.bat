@echo off
rem Double-click this file to deploy the notification functions and the Firestore rules.
cd /d "%~dp0"
echo.
echo Deploying version:
type version.txt
echo.
cd functions
call npm install
if errorlevel 1 goto failed
cd ..
call firebase deploy --only functions,firestore:rules
if errorlevel 1 goto failed
echo.
echo ===== Done. You can close this window. =====
pause
exit /b 0
:failed
echo.
echo ===== Something went wrong. Copy the messages above and send them to Claude. =====
pause
exit /b 1
