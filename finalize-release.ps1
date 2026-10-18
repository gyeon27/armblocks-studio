$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJson = [IO.File]::ReadAllText((Join-Path $projectDirectory 'package.json'), [Text.Encoding]::UTF8)
$package = $packageJson | ConvertFrom-Json
$version = $package.version
$setupDirectory = Join-Path $projectDirectory "release-$version"
$portableDirectory = Join-Path $projectDirectory "portable-$version"
$distributionDirectory = Join-Path $projectDirectory "distribution-$version"
$setupExe = Join-Path $setupDirectory "ArmBlocks-Studio-Setup-$version.exe"
$portableExe = Join-Path $portableDirectory "ArmBlocks-Studio-Portable-$version.exe"
$setupAsar = Join-Path $setupDirectory 'win-unpacked\resources\app.asar'
$portableAsar = Join-Path $portableDirectory 'win-unpacked\resources\app.asar'

function Get-Sha256([string]$filePath) {
  $sha256 = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($filePath)
  try { return [BitConverter]::ToString($sha256.ComputeHash($stream)).Replace('-', '') }
  finally { $stream.Dispose(); $sha256.Dispose() }
}

foreach ($requiredFile in @($setupExe, $portableExe, $setupAsar, $portableAsar)) {
  if (-not (Test-Path -LiteralPath $requiredFile)) { throw "필수 빌드 파일 없음: $requiredFile" }
}

$setupAppHash = Get-Sha256 $setupAsar
$portableAppHash = Get-Sha256 $portableAsar
if ($setupAppHash -ne $portableAppHash) {
  throw "설치형과 포터블형의 내부 앱이 다릅니다.`n설치형: $setupAppHash`n포터블형: $portableAppHash"
}

if (Test-Path -LiteralPath $distributionDirectory) {
  Remove-Item -LiteralPath $distributionDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $distributionDirectory | Out-Null
Copy-Item -LiteralPath $setupExe, $portableExe -Destination $distributionDirectory

$setupHash = Get-Sha256 $setupExe
$portableHash = Get-Sha256 $portableExe
$checksums = @(
  "$setupHash  $(Split-Path -Leaf $setupExe)"
  "$portableHash  $(Split-Path -Leaf $portableExe)"
) -join [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $distributionDirectory 'CHECKSUMS-SHA256.txt'), $checksums + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

$buildInfo = @(
  "ArmBlocks Studio $version"
  "Built: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))"
  "Shared app.asar SHA256: $setupAppHash"
  "Arduino runtime cache: $version"
) -join [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $distributionDirectory 'BUILD-INFO.txt'), $buildInfo + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Host "배포 폴더 완료: $distributionDirectory"
Write-Host "공통 앱 SHA256: $setupAppHash"
