#!/usr/bin/env pwsh
# Скрипт для проверки работы приложения

Write-Host "🔍 Проверяем работу приложения..." -ForegroundColor Blue

# Проверяем доступные порты
$ports = @(3000, 3001, 3002, 3003, 3004, 3005)

foreach ($port in $ports) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        $processId = $connection.OwningProcess
        $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "✅ Порт $port занят процессом $processName (PID: $processId)" -ForegroundColor Green
        
        # Проверяем доступность HTTP
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$port/miniapp/" -TimeoutSec 5 -ErrorAction Stop
            Write-Host "   🌐 HTTP доступен: $($response.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ HTTP недоступен: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Проверяем структуру проекта
Write-Host "`n📁 Проверяем структуру проекта..." -ForegroundColor Blue

$requiredFiles = @(
    "miniapp/src/App.tsx",
    "miniapp/src/main.tsx",
    "miniapp/src/pages/GalleryPage.tsx",
    "miniapp/src/components/PackCard.tsx",
    "miniapp/src/hooks/useTelegram.ts",
    "package.json",
    "vite.config.ts"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - отсутствует!" -ForegroundColor Red
    }
}

# Проверяем зависимости
Write-Host "`n📦 Проверяем зависимости..." -ForegroundColor Blue

if (Test-Path "node_modules") {
    Write-Host "✅ node_modules существует" -ForegroundColor Green
    
    # Проверяем ключевые пакеты
    $keyPackages = @("react", "vite", "@twa-dev/sdk", "zustand")
    foreach ($package in $keyPackages) {
        if (Test-Path "node_modules/$package") {
            Write-Host "✅ $package установлен" -ForegroundColor Green
        } else {
            Write-Host "❌ $package отсутствует!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ node_modules отсутствует! Запустите 'npm install'" -ForegroundColor Red
}

# Проверяем TypeScript
Write-Host "`n🔧 Проверяем TypeScript..." -ForegroundColor Blue
try {
    $tscVersion = npx tsc --version
    Write-Host "✅ TypeScript: $tscVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ TypeScript недоступен" -ForegroundColor Red
}

Write-Host "`n🎯 Проверка завершена!" -ForegroundColor Green
