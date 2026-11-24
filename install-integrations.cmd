@echo off
cd /d "%~dp0"
call npm.cmd install || (echo Dependency installation failed. Check registry/network. & pause & exit /b 1)
node -e "Promise.all([import('pg'),import('@ton/ton')]).then(()=>console.log('Integration packages installed')).catch(e=>{console.error('Required integration package missing');process.exit(1)})" || exit /b 1
pause
