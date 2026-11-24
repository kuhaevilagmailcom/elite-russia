@echo off
cd /d "%~dp0"
node -v
where docker
where psql
call npm.cmd run check
pause
