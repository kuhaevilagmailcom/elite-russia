@echo off
cd /d "%~dp0"
node --experimental-sqlite scripts/backup.mjs
pause
