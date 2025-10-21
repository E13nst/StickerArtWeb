#!/usr/bin/env pwsh
# Скрипт для быстрого тестирования приложения

Write-Host "⚡ Быстрое тестирование приложения..." -ForegroundColor Blue

# Останавливаем существующие серверы
Write-Host "🛑 Останавливаем существующие серверы..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Проверяем зависимости
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Устанавливаем зависимости..." -ForegroundColor Yellow
    npm install
}

# Быстрая проверка TypeScript
Write-Host "🔧 Быстрая проверка TypeScript..." -ForegroundColor Yellow
try {
    npx tsc --noEmit --skipLibCheck
    Write-Host "✅ TypeScript проверка пройдена" -ForegroundColor Green
} catch {
    Write-Host "⚠️ TypeScript ошибки:" -ForegroundColor Yellow
    npx tsc --noEmit --skipLibCheck
}

# Запускаем dev сервер
Write-Host "🚀 Запускаем dev сервер..." -ForegroundColor Yellow
$job = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm run dev
}

# Ждем запуска
Start-Sleep -Seconds 5

# Проверяем доступность
$found = $false
$ports = @(3000, 3001, 3002, 3003, 3004, 3005)

foreach ($port in $ports) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/miniapp/" -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ Приложение доступно на http://localhost:$port/miniapp/" -ForegroundColor Green
        Write-Host "📊 Статус: $($response.StatusCode)" -ForegroundColor Green
        $found = $true
        
        # Проверяем основные элементы
        $content = $response.Content
        if ($content -match "Stixly") {
            Write-Host "✅ Логотип найден" -ForegroundColor Green
        }
        if ($content -match "Инициализация") {
            Write-Host "⚠️ Приложение в режиме инициализации" -ForegroundColor Yellow
        }
        if ($content -match "sticker") {
            Write-Host "✅ Стикеры найдены" -ForegroundColor Green
        }
        break
    } catch {
        continue
    }
}

if (-not $found) {
    Write-Host "❌ Приложение недоступно" -ForegroundColor Red
    Write-Host "🔍 Проверьте логи:" -ForegroundColor Yellow
    Receive-Job $job
}

# Очистка
Remove-Job $job -Force

Write-Host "`n🎯 Быстрое тестирование завершено!" -ForegroundColor Green
Write-Host "💡 Для полной проверки используйте: .\scripts\check-app.ps1" -ForegroundColor Blue
