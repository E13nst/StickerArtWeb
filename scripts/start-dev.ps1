#!/usr/bin/env pwsh
# Скрипт для запуска dev сервера

Write-Host "🚀 Запускаем dev сервер..." -ForegroundColor Blue

# Проверяем зависимости
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Устанавливаем зависимости..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка установки зависимостей!" -ForegroundColor Red
        exit 1
    }
}

# Проверяем TypeScript
Write-Host "🔧 Проверяем TypeScript..." -ForegroundColor Yellow
try {
    npx tsc --noEmit
    Write-Host "✅ TypeScript проверка пройдена" -ForegroundColor Green
} catch {
    Write-Host "⚠️ TypeScript ошибки найдены:" -ForegroundColor Yellow
    npx tsc --noEmit
}

# Останавливаем существующие процессы
Write-Host "🛑 Останавливаем существующие серверы..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Запускаем dev сервер
Write-Host "⚡ Запускаем Vite dev сервер..." -ForegroundColor Yellow

# Запускаем в фоновом режиме
$job = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev
}

# Ждем немного для запуска
Start-Sleep -Seconds 3

# Проверяем статус
if ($job.State -eq "Running") {
    Write-Host "✅ Dev сервер запущен!" -ForegroundColor Green
    
    # Проверяем доступные порты
    $ports = @(3000, 3001, 3002, 3003, 3004, 3005)
    foreach ($port in $ports) {
        $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($connection) {
            $processId = $connection.OwningProcess
            Write-Host "🌐 Сервер доступен на порту $port" -ForegroundColor Green
            Write-Host "🔗 URL: http://localhost:$port/miniapp/" -ForegroundColor Cyan
            
            # Проверяем HTTP доступность
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$port/miniapp/" -TimeoutSec 5 -ErrorAction Stop
                Write-Host "✅ HTTP доступен: $($response.StatusCode)" -ForegroundColor Green
            } catch {
                Write-Host "⚠️ HTTP пока недоступен, сервер запускается..." -ForegroundColor Yellow
            }
            break
        }
    }
    
    Write-Host "`n📋 Управление сервером:" -ForegroundColor Blue
    Write-Host "   • Для остановки: .\scripts\stop-server.ps1" -ForegroundColor White
    Write-Host "   • Для пересборки: .\scripts\rebuild.ps1" -ForegroundColor White
    Write-Host "   • Для проверки: .\scripts\check-app.ps1" -ForegroundColor White
    
} else {
    Write-Host "❌ Ошибка запуска dev сервера!" -ForegroundColor Red
    Receive-Job $job
    Remove-Job $job
    exit 1
}
