@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js 22.13+ & pause & exit /b 1)
start "" http://localhost:3000
node --env-file-if-exists=.env --experimental-sqlite server-async.mjs
pause
