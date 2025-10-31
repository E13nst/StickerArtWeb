#!/usr/bin/env pwsh
# Simple script to start dev server
Write-Host "🚀 Starting dev server..." -ForegroundColor Blue

# Navigate to miniapp directory
$miniappPath = Join-Path $PSScriptRoot ".." "miniapp"
if (!(Test-Path $miniappPath)) {
    Write-Host "❌ miniapp directory not found!" -ForegroundColor Red
    exit 1
}

Set-Location $miniappPath
Write-Host "📂 Working directory: $miniappPath" -ForegroundColor Gray

# Check dependencies
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
}

# Stop existing processes on port 3000
Write-Host "🛑 Checking for existing processes on port 3000..." -ForegroundColor Yellow
$connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($connection) {
    $processId = $connection.OwningProcess
    $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
    Write-Host "   Stopping process $processName (PID: $processId)" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Set environment variables
$env:VITE_BACKEND_URL = "https://stickerartgallery-e13nst.amvera.io"

# Start dev server
Write-Host "⚡ Starting Vite dev server..." -ForegroundColor Cyan
Write-Host "   Backend URL: $env:VITE_BACKEND_URL" -ForegroundColor Gray
Write-Host "   Port: 3000" -ForegroundColor Gray
Write-Host "   Host: 0.0.0.0 (accessible from network)" -ForegroundColor Gray

npm run dev -- --host --port 3000
