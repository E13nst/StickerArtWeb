#!/usr/bin/env pwsh
# Универсальный скрипт управления проектом

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "rebuild", "check", "build", "install", "help")]
    [string]$Action = "help"
)

function Show-Help {
    Write-Host "`n🎯 Telegram Mini App - Скрипты управления" -ForegroundColor Cyan
    Write-Host "=" * 50 -ForegroundColor Cyan
    Write-Host "`n📋 Доступные команды:" -ForegroundColor Blue
    Write-Host "   start     - Запустить dev сервер" -ForegroundColor Green
    Write-Host "   stop      - Остановить dev сервер" -ForegroundColor Red
    Write-Host "   restart   - Перезапустить dev сервер" -ForegroundColor Yellow
    Write-Host "   rebuild   - Пересобрать проект" -ForegroundColor Magenta
    Write-Host "   check     - Проверить состояние приложения" -ForegroundColor Blue
    Write-Host "   build     - Собрать production версию" -ForegroundColor Cyan
    Write-Host "   install   - Установить зависимости" -ForegroundColor White
    Write-Host "   help      - Показать эту справку" -ForegroundColor Gray
    Write-Host "`n💡 Примеры использования:" -ForegroundColor Blue
    Write-Host "   .\scripts\manage.ps1 start" -ForegroundColor White
    Write-Host "   .\scripts\manage.ps1 stop" -ForegroundColor White
    Write-Host "   .\scripts\manage.ps1 restart" -ForegroundColor White
    Write-Host "`n🔧 Прямые скрипты:" -ForegroundColor Blue
    Write-Host "   .\scripts\start-dev.ps1    - Запуск dev сервера" -ForegroundColor White
    Write-Host "   .\scripts\stop-server.ps1  - Остановка сервера" -ForegroundColor White
    Write-Host "   .\scripts\rebuild.ps1      - Пересборка проекта" -ForegroundColor White
    Write-Host "   .\scripts\check-app.ps1    - Проверка приложения" -ForegroundColor White
}

function Start-DevServer {
    Write-Host "🚀 Запускаем dev сервер..." -ForegroundColor Blue
    & "$PSScriptRoot\start-dev.ps1"
}

function Stop-Server {
    Write-Host "🛑 Останавливаем сервер..." -ForegroundColor Red
    & "$PSScriptRoot\stop-server.ps1"
}

function Restart-Server {
    Write-Host "🔄 Перезапускаем сервер..." -ForegroundColor Yellow
    Stop-Server
    Start-Sleep -Seconds 2
    Start-DevServer
}

function Rebuild-Project {
    Write-Host "🔨 Пересобираем проект..." -ForegroundColor Blue
    & "$PSScriptRoot\rebuild.ps1"
}

function Check-App {
    Write-Host "🔍 Проверяем приложение..." -ForegroundColor Blue
    & "$PSScriptRoot\check-app.ps1"
}

function Build-Production {
    Write-Host "🏗️ Собираем production версию..." -ForegroundColor Blue
    
    # Останавливаем dev сервер
    Stop-Server
    
    # Пересобираем проект
    Rebuild-Project
    
    Write-Host "✅ Production сборка готова в папке dist/" -ForegroundColor Green
}

function Install-Dependencies {
    Write-Host "Installing dependencies..." -ForegroundColor Blue
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Dependencies installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Error installing dependencies!" -ForegroundColor Red
    }
}

# Основная логика
switch ($Action) {
    "start" { Start-DevServer }
    "stop" { Stop-Server }
    "restart" { Restart-Server }
    "rebuild" { Rebuild-Project }
    "check" { Check-App }
    "build" { Build-Production }
    "install" { Install-Dependencies }
    "help" { Show-Help }
    default { Show-Help }
}
