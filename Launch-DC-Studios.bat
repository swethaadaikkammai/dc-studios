@echo off
setlocal enabledelayedexpansion
title DC Studios - Launching Application...

set ROOT_DIR=%~dp0
set FRONTEND_DIR=%ROOT_DIR%frontend
set BACKEND_DIR=%ROOT_DIR%backend
set PGDATA_DIR=%ROOT_DIR%pgdata
set PG_BIN=C:\Program Files\PostgreSQL\18\bin\postgres.exe

echo =======================================================
echo          DC Studios - Dance Studio Booking Portal
echo =======================================================
echo.

:: 1. Check & Start PostgreSQL (Port 5433)
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 5433 -InformationLevel Quiet" > "%TEMP%\pg_test.txt"
set /p PG_RUNNING=<"%TEMP%\pg_test.txt"
if /i "%PG_RUNNING%"=="True" (
    echo [OK] PostgreSQL database is running on port 5433.
) else (
    echo [*] Starting PostgreSQL on port 5433...
    start /min "DCStudios-Postgres" "%PG_BIN%" -D "%PGDATA_DIR%" -p 5433
    timeout /t 2 /nobreak >nul
)

:: 2. Check & Start FastAPI Backend (Port 8000)
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -InformationLevel Quiet" > "%TEMP%\be_test.txt"
set /p BE_RUNNING=<"%TEMP%\be_test.txt"
if /i "%BE_RUNNING%"=="True" (
    echo [OK] FastAPI Backend is active on port 8000.
) else (
    echo [*] Starting FastAPI Backend on port 8000...
    start /min "DCStudios-Backend" /D "%BACKEND_DIR%" cmd /c ".\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
    timeout /t 2 /nobreak >nul
)

:: 3. Check & Start Vite Frontend (Port 5173)
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet" > "%TEMP%\fe_test.txt"
set /p FE_RUNNING=<"%TEMP%\fe_test.txt"
if /i "%FE_RUNNING%"=="True" (
    echo [OK] Vite Frontend is active on port 5173.
) else (
    echo [*] Starting Vite Frontend dev server...
    start /min "DCStudios-Frontend" /D "%FRONTEND_DIR%" cmd /c "npm run dev -- --host 127.0.0.1 --port 5173"
    timeout /t 3 /nobreak >nul
)

echo.
echo [*] Launching DC Studios in standalone App Mode...

:: 4. Launch in Chrome App Mode or Edge App Mode
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
