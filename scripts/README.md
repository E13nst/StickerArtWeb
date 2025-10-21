# 🛠️ Скрипты управления Telegram Mini App

Набор PowerShell скриптов для удобного управления и тестирования проекта.

## 📋 Доступные скрипты

### 🚀 Основные скрипты

| Скрипт | Описание | Использование |
|--------|----------|---------------|
| `manage.ps1` | Универсальный скрипт управления | `.\scripts\manage.ps1 start` |
| `start-dev.ps1` | Запуск dev сервера | `.\scripts\start-dev.ps1` |
| `stop-server.ps1` | Остановка сервера | `.\scripts\stop-server.ps1` |
| `rebuild.ps1` | Пересборка проекта | `.\scripts\rebuild.ps1` |
| `check-app.ps1` | Проверка состояния приложения | `.\scripts\check-app.ps1` |
| `quick-test.ps1` | Быстрое тестирование | `.\scripts\quick-test.ps1` |

### 🎯 Команды manage.ps1

```powershell
# Запуск dev сервера
.\scripts\manage.ps1 start

# Остановка сервера
.\scripts\manage.ps1 stop

# Перезапуск сервера
.\scripts\manage.ps1 restart

# Пересборка проекта
.\scripts\manage.ps1 rebuild

# Проверка приложения
.\scripts\manage.ps1 check

# Сборка production версии
.\scripts\manage.ps1 build

# Установка зависимостей
.\scripts\manage.ps1 install

# Справка
.\scripts\manage.ps1 help
```

## 🔧 Что делает каждый скрипт

### 🚀 start-dev.ps1
- Проверяет зависимости
- Останавливает существующие серверы
- Запускает Vite dev сервер
- Проверяет доступность HTTP
- Показывает URL для доступа

### 🛑 stop-server.ps1
- Останавливает все процессы Node.js
- Освобождает порты 3000-3010
- Показывает информацию о процессах

### 🔨 rebuild.ps1
- Останавливает сервер
- Очищает кеш (dist, .vite, node_modules/.vite)
- Проверяет TypeScript
- Собирает проект с Vite
- Показывает размер сборки

### 🔍 check-app.ps1
- Проверяет доступные порты
- Проверяет HTTP доступность
- Проверяет структуру проекта
- Проверяет зависимости
- Проверяет TypeScript

### ⚡ quick-test.ps1
- Быстрая остановка серверов
- Установка зависимостей при необходимости
- Быстрая проверка TypeScript
- Запуск и проверка доступности
- Проверка основных элементов страницы

## 🎯 Типичные сценарии использования

### 🆕 Первый запуск
```powershell
# Установить зависимости
.\scripts\manage.ps1 install

# Запустить dev сервер
.\scripts\manage.ps1 start
```

### 🔄 Ежедневная разработка
```powershell
# Быстрая проверка
.\scripts\quick-test.ps1

# Или полная проверка
.\scripts\manage.ps1 check
```

### 🚀 Перед коммитом
```powershell
# Пересобрать проект
.\scripts\manage.ps1 rebuild

# Проверить работу
.\scripts\manage.ps1 check
```

### 🛠️ Решение проблем
```powershell
# Остановить все
.\scripts\manage.ps1 stop

# Пересобрать
.\scripts\manage.ps1 rebuild

# Запустить заново
.\scripts\manage.ps1 start
```

## ⚠️ Требования

- PowerShell 5.1 или выше
- Node.js и npm
- Разрешение на выполнение скриптов PowerShell

### 🔓 Разрешение на выполнение скриптов

Если получаете ошибку "execution of scripts is disabled", выполните:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 🐛 Решение проблем

### ❌ Ошибка "execution of scripts is disabled"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ Порт занят
```powershell
# Остановить все серверы
.\scripts\stop-server.ps1

# Или найти и остановить конкретный процесс
Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Id {$_.OwningProcess} -Force
```

### ❌ Ошибки TypeScript
```powershell
# Проверить TypeScript
npx tsc --noEmit

# Или очистить и пересобрать
.\scripts\manage.ps1 rebuild
```

### ❌ Проблемы с зависимостями
```powershell
# Переустановить зависимости
Remove-Item -Recurse -Force node_modules
.\scripts\manage.ps1 install
```

## 📊 Мониторинг

Все скрипты выводят подробную информацию о:
- Статусе процессов
- Доступности портов
- Размере сборки
- HTTP статусе
- Ошибках и предупреждениях

## 🎯 Автоматизация

Скрипты можно использовать в:
- CI/CD пайплайнах
- Автоматических тестах
- Скриптах развертывания
- Мониторинге приложения
