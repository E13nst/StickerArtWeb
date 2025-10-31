#!/usr/bin/env pwsh
# Simple script to stop dev server
Write-Host "🛑 Stopping dev server..." -ForegroundColor Red

$stopped = $false

# Stop process on port 3000 (our dev server)
Write-Host "Checking port 3000..." -ForegroundColor Yellow
$connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($connection) {
    $processId = $connection.OwningProcess
    $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
    Write-Host "   Stopping $processName (PID: $processId) on port 3000" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    $stopped = $true
    Write-Host "   ✓ Process stopped" -ForegroundColor Green
} else {
    Write-Host "   No process found on port 3000" -ForegroundColor Gray
}

# Optional: Stop all Node.js processes (use with caution)
$stopAllNode = $false  # Set to $true if you want to stop all Node processes
if ($stopAllNode) {
    Write-Host "`nStopping all Node.js processes..." -ForegroundColor Yellow
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($nodeProcesses) {
        Write-Host "Found Node.js processes:" -ForegroundColor Yellow
        $nodeProcesses | Format-Table Id, ProcessName, StartTime
        
        $nodeProcesses | Stop-Process -Force
        $stopped = $true
        Write-Host "All Node.js processes stopped" -ForegroundColor Green
    } else {
        Write-Host "No Node.js processes found" -ForegroundColor Gray
    }
}

if ($stopped) {
    Write-Host "`n✅ Server stopped successfully!" -ForegroundColor Green
} else {
    Write-Host "`nℹ️ No dev server was running" -ForegroundColor Blue
}
