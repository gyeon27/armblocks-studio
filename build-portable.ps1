$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJson = [IO.File]::ReadAllText((Join-Path $projectDirectory 'package.json'), [Text.Encoding]::UTF8)
$package = $packageJson | ConvertFrom-Json
$version = $package.version
$outputDirectory = "portable-$version"
$artifactName = "ArmBlocks-Studio-Portable-$version." + '${ext}'

Push-Location $projectDirectory
try {
  & npx.cmd electron-builder --win portable --config.compression=normal "--config.directories.output=$outputDirectory" "--config.win.artifactName=$artifactName"
  if ($LASTEXITCODE -ne 0) { throw "포터블 패키징 실패: $LASTEXITCODE" }
} finally {
  Pop-Location
}
