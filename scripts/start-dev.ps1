#!/usr/bin/env pwsh
# Скрипт для запуска dev сервера с дополнительными проверками

Write-Host "🚀 Запускаем dev сервер..." -ForegroundColor Blue

# Navigate to miniapp directory
$miniappPath = Join-Path $PSScriptRoot ".." "miniapp"
if (!(Test-Path $miniappPath)) {
    Write-Host "❌ miniapp directory not found!" -ForegroundColor Red
    exit 1
}

Set-Location $miniappPath
Write-Host "📂 Working directory: $miniappPath" -ForegroundColor Gray

# Проверяем зависимости
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Устанавливаем зависимости..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка установки зависимостей!" -ForegroundColor Red
        exit 1
    }
}

# Проверяем TypeScript (опционально, не блокирует запуск)
Write-Host "🔧 Проверяем TypeScript..." -ForegroundColor Yellow
npx tsc --noEmit --pretty
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ TypeScript проверка пройдена" -ForegroundColor Green
} else {
    Write-Host "⚠️ TypeScript ошибки найдены, но продолжаем запуск..." -ForegroundColor Yellow
}

# Останавливаем существующие процессы на порту 3000
Write-Host "🛑 Проверяем существующие серверы на порту 3000..." -ForegroundColor Yellow
$connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($connection) {
    $processId = $connection.OwningProcess
    $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
    Write-Host "   Останавливаем $processName (PID: $processId)" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Set environment variables
$env:VITE_BACKEND_URL = "https://stickerartgallery-e13nst.amvera.io"

# Запускаем dev сервер
Write-Host "⚡ Запускаем Vite dev сервер..." -ForegroundColor Cyan
Write-Host "   Backend URL: $env:VITE_BACKEND_URL" -ForegroundColor Gray
Write-Host "   Port: 3000" -ForegroundColor Gray
Write-Host "   Host: 0.0.0.0 (доступен из сети)" -ForegroundColor Gray

# Запускаем в фоновом режиме
$job = Start-Job -ScriptBlock {
    param($workDir, $backendUrl)
    Set-Location $workDir
    $env:VITE_BACKEND_URL = $backendUrl
    npm run dev -- --host --port 3000
} -ArgumentList $miniappPath, $env:VITE_BACKEND_URL

# Ждем запуск сервера
Write-Host "`n⏳ Ждем запуск сервера..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Проверяем статус
$maxAttempts = 10
$attempt = 0
$serverRunning = $false

while ($attempt -lt $maxAttempts -and !$serverRunning) {
    $attempt++
    $connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        $serverRunning = $true
        Write-Host "✅ Dev сервер запущен!" -ForegroundColor Green
        Write-Host "🔗 Local:   http://localhost:3000/miniapp/" -ForegroundColor Cyan
        Write-Host "🌐 Network: http://[your-IP]:3000/miniapp/" -ForegroundColor Cyan
        
        # Проверяем HTTP доступность
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/miniapp/" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            Write-Host "✅ HTTP доступен: $($response.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ HTTP пока недоступен, сервер все еще запускается..." -ForegroundColor Yellow
        }
        break
    } else {
        Write-Host "   Попытка $attempt/$maxAttempts..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if ($job.State -eq "Running" -and $serverRunning) {
    Write-Host "`n📋 Управление сервером:" -ForegroundColor Blue
    Write-Host "   • Остановка:   .\scripts\simple-stop.ps1" -ForegroundColor White
    Write-Host "   • Рестарт:     .\scripts\simple-restart.ps1" -ForegroundColor White
    Write-Host "   • Пересборка:  .\scripts\simple-rebuild.ps1" -ForegroundColor White
    Write-Host "   • Проверка:    .\scripts\simple-check.ps1" -ForegroundColor White
    
    Write-Host "`nℹ️  Для выхода нажмите Ctrl+C" -ForegroundColor Gray
    
    # Wait for job to complete or user interrupt
    Wait-Job $job
    Receive-Job $job
    Remove-Job $job
} else {
    Write-Host "❌ Ошибка запуска dev сервера!" -ForegroundColor Red
    if ($job.State -ne "Running") {
        Write-Host "Job state: $($job.State)" -ForegroundColor Red
        Receive-Job $job
    }
    Remove-Job $job
    exit 1
}
