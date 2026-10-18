$ErrorActionPreference = 'SilentlyContinue'
$installDirectory = $PSScriptRoot
Get-Process -Name 'ArmBlocks Studio' -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ArmBlocks Studio.lnk') -Force
Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Programs')) 'ArmBlocks Studio') -Recurse -Force
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ArmBlocksStudio' -Recurse -Force
$cleanup = "Start-Sleep -Seconds 2; Remove-Item -LiteralPath '$($installDirectory.Replace("'", "''"))' -Recurse -Force"
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',$cleanup

