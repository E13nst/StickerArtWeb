#!/usr/bin/env pwsh
# Скрипт для остановки dev сервера

Write-Host "🛑 Останавливаем dev сервер..." -ForegroundColor Red

# Останавливаем все процессы Node.js
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Найдены процессы Node.js:" -ForegroundColor Yellow
    $nodeProcesses | Format-Table Id, ProcessName, StartTime
    
    $nodeProcesses | Stop-Process -Force
    Write-Host "✅ Все процессы Node.js остановлены" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Процессы Node.js не найдены" -ForegroundColor Blue
}

# Останавливаем процессы на портах 3000-3010
$ports = @(3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010)

foreach ($port in $ports) {
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($process) {
        $processId = $process.OwningProcess
        $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "🔄 Останавливаем процесс $processName (PID: $processId) на порту $port" -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "✅ Сервер успешно остановлен!" -ForegroundColor Green
