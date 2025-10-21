# 🛠️ Локальное тестирование Telegram Mini App

Полное руководство по локальному тестированию и управлению проектом.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```powershell
npm install
```

### 2. Проверка состояния
```powershell
npm run check
```

### 3. Запуск dev сервера
```powershell
npm run start
```

### 4. Остановка сервера
```powershell
npm run stop
```

## 📋 Доступные команды

### 🎯 NPM скрипты (рекомендуется)

| Команда | Описание | Использование |
|---------|----------|---------------|
| `npm run start` | Запуск dev сервера | `npm run start` |
| `npm run stop` | Остановка сервера | `npm run stop` |
| `npm run restart` | Перезапуск сервера | `npm run restart` |
| `npm run rebuild` | Пересборка проекта | `npm run rebuild` |
| `npm run check` | Проверка состояния | `npm run check` |
| `npm run quick-test` | Быстрое тестирование | `npm run quick-test` |

### 🔧 Прямые PowerShell скрипты

| Скрипт | Описание | Использование |
|--------|----------|---------------|
| `.\scripts\simple-start.ps1` | Запуск dev сервера | `.\scripts\simple-start.ps1` |
| `.\scripts\simple-stop.ps1` | Остановка сервера | `.\scripts\simple-stop.ps1` |
| `.\scripts\simple-rebuild.ps1` | Пересборка проекта | `.\scripts\simple-rebuild.ps1` |
| `.\scripts\simple-check.ps1` | Проверка состояния | `.\scripts\simple-check.ps1` |

## 🎯 Типичные сценарии

### 🆕 Первый запуск проекта
```powershell
# 1. Установить зависимости
npm install

# 2. Проверить состояние
npm run check

# 3. Запустить сервер
npm run start
```

### 🔄 Ежедневная разработка
```powershell
# 1. Быстрая проверка
npm run check

# 2. Запуск сервера
npm run start

# 3. Остановка после работы
npm run stop
```

### 🚀 Перед коммитом
```powershell
# 1. Остановить сервер
npm run stop

# 2. Пересобрать проект
npm run rebuild

# 3. Проверить работу
npm run check
```

### 🛠️ Решение проблем
```powershell
# 1. Остановить все
npm run stop

# 2. Пересобрать
npm run rebuild

# 3. Запустить заново
npm run start
```

## 🔧 Что делает каждый скрипт

### 🚀 start / simple-start.ps1
- Останавливает существующие серверы
- Проверяет зависимости
- Запускает Vite dev сервер
- Показывает URL для доступа

### 🛑 stop / simple-stop.ps1
- Останавливает все процессы Node.js
- Освобождает порты 3000-3010
- Показывает информацию о процессах

### 🔨 rebuild / simple-rebuild.ps1
- Останавливает сервер
- Очищает кеш (dist, .vite, node_modules/.vite)
- Проверяет TypeScript
- Собирает проект с Vite
- Показывает размер сборки

### 🔍 check / simple-check.ps1
- Проверяет доступные порты
- Проверяет HTTP доступность
- Проверяет структуру проекта
- Проверяет зависимости
- Проверяет TypeScript

## 🌐 Доступ к приложению

После запуска сервера приложение будет доступно по адресу:
- **Локально**: `http://localhost:3000/miniapp/` (или 3001, 3002, etc.)
- **В сети**: `http://[ваш-ip]:3000/miniapp/`

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
npm run stop

# Или найти и остановить конкретный процесс
Get-NetTCPConnection -LocalPort 3000 | Stop-Process -Id {$_.OwningProcess} -Force
```

### ❌ Ошибки TypeScript
```powershell
# Проверить TypeScript
npx tsc --noEmit

# Или очистить и пересобрать
npm run rebuild
```

### ❌ Проблемы с зависимостями
```powershell
# Переустановить зависимости
Remove-Item -Recurse -Force node_modules
npm install
```

### ❌ Приложение не загружается
```powershell
# 1. Остановить сервер
npm run stop

# 2. Пересобрать проект
npm run rebuild

# 3. Запустить заново
npm run start

# 4. Проверить состояние
npm run check
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
npm run check

# Запустить сервер
npm run start
```

### Остановка проекта
```powershell
# Остановить сервер
npm run stop
```

### Пересборка проекта
```powershell
# Остановить сервер
npm run stop

# Пересобрать проект
npm run rebuild

# Запустить заново
npm run start
```

### Проверка состояния
```powershell
# Полная проверка
npm run check
```

## 🔍 Отладка

### Проверка портов
```powershell
# Посмотреть какие порты заняты
Get-NetTCPConnection | Where-Object {$_.LocalPort -ge 3000 -and $_.LocalPort -le 3010}
```

### Проверка процессов Node.js
```powershell
# Посмотреть процессы Node.js
Get-Process -Name "node"
```

### Проверка HTTP доступности
```powershell
# Проверить доступность приложения
Invoke-WebRequest -Uri "http://localhost:3000/miniapp/" -TimeoutSec 5
```

## 📚 Дополнительные ресурсы

- [README скриптов](scripts/README-SIMPLE.md) - Подробное описание скриптов
- [Telegram Mini App документация](https://core.telegram.org/bots/webapps)
- [Vite документация](https://vitejs.dev/)
- [React документация](https://react.dev/)
