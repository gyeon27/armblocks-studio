@echo off
chcp 65001 >nul
cd /d "%~dp0"
set LOG=%~dp0build-release.log
echo [%date% %time%] start > "%LOG%"
taskkill /f /im "ArmBlocks Studio.exe" >> "%LOG%" 2>&1
timeout /t 2 /nobreak >nul
echo ==== npm run dist ==== >> "%LOG%"
call npm run dist >> "%LOG%" 2>&1
echo dist exit %errorlevel% >> "%LOG%"
echo [%date% %time%] done >> "%LOG%"
echo DONE. See build-release.log
pause
