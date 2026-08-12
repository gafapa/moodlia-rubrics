$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$extensionDir = Join-Path $projectRoot 'extension'
$distDir = Join-Path $projectRoot 'dist'
$manifestPath = Join-Path $extensionDir 'manifest.json'

if (!(Test-Path -LiteralPath $manifestPath)) {
    throw 'extension/manifest.json is missing.'
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$archiveName = "moodle-rubric-importer-$($manifest.version).zip"
$archivePath = Join-Path $distDir $archiveName

if (!(Test-Path -LiteralPath $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

$extensionItems = Get-ChildItem -LiteralPath $extensionDir -Force | ForEach-Object { $_.FullName }
Compress-Archive -Path $extensionItems -DestinationPath $archivePath -Force

Write-Host "Created $archivePath"
