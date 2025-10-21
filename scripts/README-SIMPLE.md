# 🛠️ Простые скрипты управления Telegram Mini App

Набор простых PowerShell скриптов для управления и тестирования проекта без специальных символов.

## 📋 Доступные скрипты

### 🚀 Основные скрипты

| Скрипт | Описание | Использование |
|--------|----------|---------------|
| `simple-start.ps1` | Запуск dev сервера | `.\scripts\simple-start.ps1` |
| `simple-stop.ps1` | Остановка сервера | `.\scripts\simple-stop.ps1` |
| `simple-rebuild.ps1` | Пересборка проекта | `.\scripts\simple-rebuild.ps1` |
| `simple-check.ps1` | Проверка состояния приложения | `.\scripts\simple-check.ps1` |

### 🎯 NPM скрипты (обновлены)

```powershell
# Запуск dev сервера
npm run start

# Остановка сервера
npm run stop

# Перезапуск сервера
npm run restart

# Пересборка проекта
npm run rebuild

# Проверка приложения
npm run check

# Быстрое тестирование
npm run quick-test
```

## 🔧 Что делает каждый скрипт

### 🚀 simple-start.ps1
- Останавливает существующие серверы
- Проверяет зависимости
- Запускает Vite dev сервер

### 🛑 simple-stop.ps1
- Останавливает все процессы Node.js
- Освобождает порты 3000-3010
- Показывает информацию о процессах

### 🔨 simple-rebuild.ps1
- Останавливает сервер
- Очищает кеш (dist, .vite, node_modules/.vite)
- Проверяет TypeScript
- Собирает проект с Vite
- Показывает размер сборки

### 🔍 simple-check.ps1
- Проверяет доступные порты
- Проверяет HTTP доступность
- Проверяет структуру проекта
- Проверяет зависимости
- Проверяет TypeScript

## 🎯 Типичные сценарии использования

### 🆕 Первый запуск
```powershell
# Проверить состояние
.\scripts\simple-check.ps1

# Запустить dev сервер
.\scripts\simple-start.ps1
```

### 🔄 Ежедневная разработка
```powershell
# Быстрая проверка
.\scripts\simple-check.ps1

# Запуск сервера
.\scripts\simple-start.ps1
```

### 🚀 Перед коммитом
```powershell
# Остановить сервер
.\scripts\simple-stop.ps1

# Пересобрать проект
.\scripts\simple-rebuild.ps1

# Проверить работу
.\scripts\simple-check.ps1
```

### 🛠️ Решение проблем
```powershell
# Остановить все
.\scripts\simple-stop.ps1

# Пересобрать
.\scripts\simple-rebuild.ps1

# Запустить заново
.\scripts\simple-start.ps1
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
.\scripts\simple-stop.ps1

# Или найти и остановить конкретный процесс
Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Id {$_.OwningProcess} -Force
```

### ❌ Ошибки TypeScript
```powershell
# Проверить TypeScript
npx tsc --noEmit

# Или очистить и пересобрать
.\scripts\simple-rebuild.ps1
```

### ❌ Проблемы с зависимостями
```powershell
# Переустановить зависимости
Remove-Item -Recurse -Force node_modules
npm install
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

## 📝 Примеры использования

### Запуск проекта
```powershell
# Проверить состояние
.\scripts\simple-check.ps1

# Запустить сервер
.\scripts\simple-start.ps1
```

### Остановка проекта
```powershell
# Остановить сервер
.\scripts\simple-stop.ps1
```

### Пересборка проекта
```powershell
# Остановить сервер
.\scripts\simple-stop.ps1

# Пересобрать проект
.\scripts\simple-rebuild.ps1

# Запустить заново
.\scripts\simple-start.ps1
```

### Проверка состояния
```powershell
# Полная проверка
.\scripts\simple-check.ps1
```
