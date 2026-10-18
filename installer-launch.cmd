@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer-install.ps1"
if errorlevel 1 (
  echo ArmBlocks Studio installation failed.
  pause
  exit /b 1
)

