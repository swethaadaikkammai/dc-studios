@echo off
setlocal enabledelayedexpansion
title DC Studios - Launching Application...

set ROOT_DIR=%~dp0
set FRONTEND_DIR=%ROOT_DIR%frontend
set BACKEND_DIR=%ROOT_DIR%backend

echo =======================================================
echo          DC Studios - Dance Studio Booking Portal
echo =======================================================
echo.

:: 1. Check & Start FastAPI Backend (Port 8001)
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 8001 -InformationLevel Quiet" > "%TEMP%\be_test.txt"
set /p BE_RUNNING=<"%TEMP%\be_test.txt"
if /i "%BE_RUNNING%"=="True" (
    echo [OK] FastAPI Backend is already active on port 8001.
) else (
    echo [*] Starting FastAPI Backend on port 8001...
    start "DCStudios-Backend" /D "%BACKEND_DIR%" cmd /k "set PYTHONPATH=%BACKEND_DIR%;%BACKEND_DIR%\.venv\Lib\site-packages&& python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"
    timeout /t 3 /nobreak >nul
)

:: 2. Check & Start Vite Frontend (Port 5173)
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet" > "%TEMP%\fe_test.txt"
set /p FE_RUNNING=<"%TEMP%\fe_test.txt"
if /i "%FE_RUNNING%"=="True" (
    echo [OK] Vite Frontend is already active on port 5173.
) else (
    echo [*] Starting Vite Frontend dev server...
    start "DCStudios-Frontend" /D "%FRONTEND_DIR%" cmd /k "npm run dev -- --host 0.0.0.0 --port 5173"
    timeout /t 4 /nobreak >nul
)

echo.
echo [*] Launching DC Studios in App Mode...

:: 3. Launch in Chrome App Mode or Edge App Mode
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:5173" --window-size=1280,840
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://127.0.0.1:5173" --window-size=1280,840
) else (
    start "" "http://127.0.0.1:5173"
)

echo [OK] DC Studios launched successfully!
timeout /t 2 /nobreak >nul
exit
