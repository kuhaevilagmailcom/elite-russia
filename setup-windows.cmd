@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js 22.13+ & pause & exit /b 1)
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)" || exit /b 1
if not exist .env copy .env.example .env >nul
call npm.cmd run check || exit /b 1
call npm.cmd test || exit /b 1
echo Local sandbox ready. Start with start-windows.cmd.
pause
