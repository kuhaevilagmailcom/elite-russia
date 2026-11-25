@echo off
chcp 65001 >nul
setlocal
title MINION MARKET — TEST
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.13 or newer is required: https://nodejs.org/
  pause
  exit /b 1
)
if not exist data mkdir data
set "APP_ENV=development"
set "BIND_HOST=127.0.0.1"
set "PORT=3000"
set "LIVE_FINANCE_ENABLED=false"
set "LIVE_DEPOSITS_ENABLED=false"
set "LIVE_WITHDRAWALS_ENABLED=false"
set "CUSTODY_ENABLED=false"
echo Starting MINION MARKET in TEST mode. Real finance and custody are disabled.
start "MINION MARKET browser" cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:3000/"
echo Close this window or press Ctrl+C to stop the local server.
node --experimental-sqlite server-async.mjs
endlocal
