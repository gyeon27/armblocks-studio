$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJson = [IO.File]::ReadAllText((Join-Path $projectDirectory 'package.json'), [Text.Encoding]::UTF8)
$package = $packageJson | ConvertFrom-Json
$version = $package.version
$compactVersion = $version.Replace('.', '')
$releaseDirectory = Join-Path $projectDirectory "release-$version"
$appDirectory = Join-Path $releaseDirectory 'win-unpacked'
$sevenZip = Join-Path $projectDirectory 'node_modules\electron-winstaller\vendor\7z.exe'
$sevenZipDll = Join-Path $projectDirectory 'node_modules\electron-winstaller\vendor\7z.dll'
$stagingDirectory = Join-Path $env:TEMP "ArmBlocksInstaller$compactVersion"
$temporaryOutput = Join-Path $env:TEMP "ArmBlocks-Studio-Setup-$version.exe"
$finalOutput = Join-Path $releaseDirectory "ArmBlocks-Studio-Setup-$version.exe"
$sedPath = Join-Path $env:TEMP "armblocks-installer-$compactVersion.sed"

if (-not (Test-Path (Join-Path $appDirectory 'ArmBlocks Studio.exe'))) {
  throw '먼저 npm run pack:app을 실행해야 합니다.'
}

if (Test-Path $stagingDirectory) { Remove-Item -LiteralPath $stagingDirectory -Recurse -Force }
New-Item -ItemType Directory -Path $stagingDirectory | Out-Null

$payload = Join-Path $stagingDirectory 'app.7z'
& $sevenZip a -t7z -mx=1 $payload (Join-Path $appDirectory '*') | Out-Null
if ($LASTEXITCODE -ne 0) { throw '앱 페이로드 압축에 실패했습니다.' }

Copy-Item -LiteralPath $sevenZip -Destination (Join-Path $stagingDirectory '7z-x64.exe')
Copy-Item -LiteralPath $sevenZipDll -Destination (Join-Path $stagingDirectory '7z.dll')
Copy-Item -LiteralPath (Join-Path $projectDirectory 'installer-install.ps1') -Destination $stagingDirectory
Copy-Item -LiteralPath (Join-Path $projectDirectory 'installer-launch.cmd') -Destination $stagingDirectory

$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$temporaryOutput
FriendlyName=ArmBlocks Studio $version Installer
AppLaunched=cmd.exe /c installer-launch.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=cmd.exe /c installer-launch.cmd
UserQuietInstCmd=cmd.exe /c installer-launch.cmd
FILE0="app.7z"
FILE1="7z-x64.exe"
FILE2="installer-install.ps1"
FILE3="installer-launch.cmd"
FILE4="7z.dll"
[SourceFiles]
SourceFiles0=$stagingDirectory\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
%FILE4%=
"@
[System.IO.File]::WriteAllText($sedPath, $sed, [System.Text.Encoding]::ASCII)

if (Test-Path $temporaryOutput) { Remove-Item -LiteralPath $temporaryOutput -Force }
$iexpress = Join-Path $env:SystemRoot 'System32\iexpress.exe'
& $iexpress /N /Q $sedPath
$launchExitCode = $LASTEXITCODE
$deadline = (Get-Date).AddMinutes(10)
do {
  $workers = @(Get-Process iexpress, makecab -ErrorAction SilentlyContinue)
  if ($workers.Count -eq 0) { break }
  Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)
if ($workers.Count -gt 0) { throw 'IExpress 설치 파일 생성 시간이 10분을 초과했습니다.' }
if ($launchExitCode -ne 0 -or -not (Test-Path $temporaryOutput) -or (Get-Item $temporaryOutput).Length -lt 1MB) {
  throw "IExpress 설치 파일 생성 실패: $launchExitCode"
}

Copy-Item -LiteralPath $temporaryOutput -Destination $finalOutput -Force
$result = Get-Item -LiteralPath $finalOutput
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$stream = [System.IO.File]::OpenRead($finalOutput)
try { $hash = [System.BitConverter]::ToString($sha256.ComputeHash($stream)).Replace('-', '') }
finally { $stream.Dispose(); $sha256.Dispose() }
Write-Host "완료: $($result.FullName)"
Write-Host "크기: $($result.Length) bytes"
Write-Host "SHA256: $hash"
