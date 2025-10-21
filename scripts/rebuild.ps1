#!/usr/bin/env pwsh
# Скрипт для пересборки проекта

Write-Host "🔨 Пересобираем проект..." -ForegroundColor Blue

# Останавливаем сервер если он запущен
Write-Host "🛑 Останавливаем dev сервер..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# Очищаем кеш и временные файлы
Write-Host "🧹 Очищаем кеш..." -ForegroundColor Yellow

if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "✅ Папка dist очищена" -ForegroundColor Green
}

if (Test-Path "node_modules/.vite") {
    Remove-Item -Recurse -Force "node_modules/.vite"
    Write-Host "✅ Vite кеш очищен" -ForegroundColor Green
}

if (Test-Path ".vite") {
    Remove-Item -Recurse -Force ".vite"
    Write-Host "✅ .vite кеш очищен" -ForegroundColor Green
}

# Проверяем зависимости
Write-Host "📦 Проверяем зависимости..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "📥 Устанавливаем зависимости..." -ForegroundColor Blue
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
    Write-Host "⚠️ TypeScript ошибки:" -ForegroundColor Yellow
    npx tsc --noEmit
}

# Собираем проект
Write-Host "🏗️ Собираем проект..." -ForegroundColor Yellow

# Создаем папку dist
New-Item -ItemType Directory -Force -Path "dist" | Out-Null

# Копируем index.html
Copy-Item "index.html" "dist/" -Force
Write-Host "✅ index.html скопирован" -ForegroundColor Green

# Компилируем TypeScript
Write-Host "🔨 Компилируем TypeScript..." -ForegroundColor Yellow
npx tsc
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ TypeScript скомпилирован" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка компиляции TypeScript!" -ForegroundColor Red
    exit 1
}

# Собираем с Vite
Write-Host "⚡ Собираем с Vite..." -ForegroundColor Yellow
npx vite build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Проект успешно собран!" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка сборки Vite!" -ForegroundColor Red
    exit 1
}

# Показываем размер сборки
if (Test-Path "dist/miniapp") {
    $buildSize = (Get-ChildItem -Path "dist/miniapp" -Recurse | Measure-Object -Property Length -Sum).Sum
    $buildSizeMB = [math]::Round($buildSize / 1MB, 2)
    Write-Host "📊 Размер сборки: $buildSizeMB MB" -ForegroundColor Blue
}

Write-Host "`n🎉 Пересборка завершена успешно!" -ForegroundColor Green
Write-Host "📁 Сборка находится в папке: dist/" -ForegroundColor Blue
