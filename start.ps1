# Starts the Scan ID system: launches Docker Desktop if needed, then all containers.
# Usage (PowerShell):  cd E:\ScanIDCard ; .\start.ps1          add -Build after code changes
param([switch]$Build)
Set-Location $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  $exe = @(
    "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
    "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $exe) { Write-Host "Docker Desktop not found - start it manually." -ForegroundColor Red; exit 1 }
  Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
  Start-Process $exe
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
  if ($LASTEXITCODE -ne 0) { Write-Host "Docker did not start in time." -ForegroundColor Red; exit 1 }
}

if ($Build) { docker compose up -d --build } else { docker compose up -d }
docker compose ps
Write-Host "`nScan ID is running:  http://localhost:3000" -ForegroundColor Green
