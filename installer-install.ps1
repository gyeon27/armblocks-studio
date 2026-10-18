$ErrorActionPreference = 'Stop'
$sourceDirectory = $PSScriptRoot
$installDirectory = Join-Path $env:LOCALAPPDATA 'Programs\ArmBlocks Studio'

Get-Process -Name 'ArmBlocks Studio' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
& (Join-Path $sourceDirectory '7z-x64.exe') x -y (Join-Path $sourceDirectory 'app.7z') "-o$installDirectory" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'ArmBlocks 파일 압축을 풀지 못했습니다.' }
Remove-Item -LiteralPath (Join-Path $installDirectory 'Uninstall ArmBlocks Studio.ps1') -Force -ErrorAction SilentlyContinue

$shell = New-Object -ComObject WScript.Shell
$desktopShortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'ArmBlocks Studio.lnk'))
$desktopShortcut.TargetPath = Join-Path $installDirectory 'ArmBlocks Studio.exe'
$desktopShortcut.WorkingDirectory = $installDirectory
$desktopShortcut.Save()

$startMenuDirectory = Join-Path ([Environment]::GetFolderPath('Programs')) 'ArmBlocks Studio'
New-Item -ItemType Directory -Force -Path $startMenuDirectory | Out-Null
$startShortcut = $shell.CreateShortcut((Join-Path $startMenuDirectory 'ArmBlocks Studio.lnk'))
$startShortcut.TargetPath = Join-Path $installDirectory 'ArmBlocks Studio.exe'
$startShortcut.WorkingDirectory = $installDirectory
$startShortcut.Save()

$uninstallShortcut = $shell.CreateShortcut((Join-Path $startMenuDirectory 'Uninstall ArmBlocks Studio.lnk'))
$uninstallShortcut.TargetPath = Join-Path $installDirectory 'ArmBlocks Studio.exe'
$uninstallShortcut.Arguments = '--uninstall'
$uninstallShortcut.WorkingDirectory = $installDirectory
$uninstallShortcut.Save()

$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ArmBlocksStudio'
New-Item -Path $uninstallKey -Force | Out-Null
Set-ItemProperty -Path $uninstallKey -Name DisplayName -Value 'ArmBlocks Studio'
Set-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value '0.1.6'
Set-ItemProperty -Path $uninstallKey -Name Publisher -Value 'School Robotics Team'
Set-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $installDirectory
Set-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value (Join-Path $installDirectory 'ArmBlocks Studio.exe')
Set-ItemProperty -Path $uninstallKey -Name UninstallString -Value "`"$installDirectory\ArmBlocks Studio.exe`" --uninstall"
Set-ItemProperty -Path $uninstallKey -Name NoModify -Type DWord -Value 1
Set-ItemProperty -Path $uninstallKey -Name NoRepair -Type DWord -Value 1

Start-Process -FilePath (Join-Path $installDirectory 'ArmBlocks Studio.exe') -WorkingDirectory $installDirectory

