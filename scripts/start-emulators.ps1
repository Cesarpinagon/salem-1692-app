$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$java = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  ForEach-Object { Join-Path $_.FullName 'bin\java.exe' } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1

if (-not $java) {
  throw 'No se encontro Java. Instala Eclipse Temurin JDK 17 o superior.'
}

$env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent
$env:Path = "$(Split-Path $java -Parent);$env:Path"
$env:XDG_CONFIG_HOME = Join-Path $projectRoot '.firebase-cli'

$dataDirectory = Join-Path $projectRoot '.firebase-data'
$arguments = @('emulators:start', '--project', 'salem-1692-16b8b', '--export-on-exit', $dataDirectory)
if (Test-Path -LiteralPath $dataDirectory) {
  $arguments += @('--import', $dataDirectory)
}

Write-Host "Java: $java"
Write-Host 'Firebase Emulator UI: http://127.0.0.1:4000'
Write-Host 'Aplicacion: http://127.0.0.1:5000'
$lanAddress = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
  Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
  Select-Object -ExpandProperty IPv4Address -First 1 |
  Select-Object -ExpandProperty IPAddress -First 1
if ($lanAddress) {
  Write-Host "Telefonos en la misma red: http://${lanAddress}:5000" -ForegroundColor Green
}

& firebase @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
