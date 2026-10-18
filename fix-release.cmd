@echo off
chcp 65001 >nul
cd /d "%~dp0"
set LOG=%~dp0fix-release.log
echo [%date% %time%] start > "%LOG%"

rem 1) close running app
taskkill /f /im "ArmBlocks Studio.exe" >> "%LOG%" 2>&1
timeout /t 2 /nobreak >nul

rem 2) slim the 58MB library index (arduino-cli parses it on every call). Original is kept as a backup.
set IDX=vendor\arduino-runtime\data\library_index.json
for %%A in ("%IDX%") do if %%~zA GTR 1000000 (
  if not exist "vendor\library_index.full.json.bak" move /y "%IDX%" "vendor\library_index.full.json.bak" >> "%LOG%" 2>&1
  if exist "%IDX%" del /f /q "%IDX%" >> "%LOG%" 2>&1
  > "%IDX%" echo {"libraries":[]}
  echo library index slimmed >> "%LOG%"
)

rem 3) remove broken build output (app.asar was 0 bytes)
if exist "release-0.1.3" rmdir /s /q "release-0.1.3" >> "%LOG%" 2>&1
if exist "portable-0.1.3" rmdir /s /q "portable-0.1.3" >> "%LOG%" 2>&1
if exist "distribution-0.1.3" rmdir /s /q "distribution-0.1.3" >> "%LOG%" 2>&1
if exist "release\win-unpacked" rmdir /s /q "release\win-unpacked" >> "%LOG%" 2>&1

rem 4) rebuild app + installer + portable + verification
echo ==== dist (matched 0.1.3 outputs) ==== >> "%LOG%"
call npm run dist >> "%LOG%" 2>&1
echo dist exit %errorlevel% >> "%LOG%"

for %%F in ("release-0.1.3\win-unpacked\resources\app.asar" "portable-0.1.3\win-unpacked\resources\app.asar" "distribution-0.1.3\ArmBlocks-Studio-Setup-0.1.3.exe" "distribution-0.1.3\ArmBlocks-Studio-Portable-0.1.3.exe") do echo %%~zF bytes  %%~F >> "%LOG%"
echo [%date% %time%] done >> "%LOG%"
echo DONE. See fix-release.log
