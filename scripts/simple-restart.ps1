#!/usr/bin/env pwsh
# Simple script to restart dev server
Write-Host "🔄 Restarting dev server..." -ForegroundColor Cyan

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stopScript = Join-Path $scriptDir "simple-stop.ps1"
$startScript = Join-Path $scriptDir "simple-start.ps1"

# Stop the server
Write-Host "`n=== Step 1: Stopping server ===" -ForegroundColor Yellow
if (Test-Path $stopScript) {
    & $stopScript
} else {
    Write-Host "⚠️ Stop script not found, attempting direct stop..." -ForegroundColor Yellow
    $connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        $processId = $connection.OwningProcess
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "✓ Process stopped" -ForegroundColor Green
    }
}

# Wait a bit for cleanup
Write-Host "`n⏳ Waiting for cleanup..." -ForegroundColor Gray
Start-Sleep -Seconds 2

# Start the server
Write-Host "`n=== Step 2: Starting server ===" -ForegroundColor Yellow
if (Test-Path $startScript) {
    & $startScript
} else {
    Write-Host "❌ Start script not found!" -ForegroundColor Red
    exit 1
}




















