# 🚀 Инструкции по деплою StickerArtWeb

## ✅ Исправления для 500 Internal Server Error

### 1. **Конфигурация nginx**
- ✅ Добавлена поддержка `/mini-app-react/` пути
- ✅ Настроен редирект с корня на `/mini-app-react/`
- ✅ Исправлены proxy_pass для API запросов
- ✅ Добавлены CORS заголовки

### 2. **Vite конфигурация**
- ✅ Настроен base path для production: `/mini-app-react/`
- ✅ Development использует `/` (localhost)
- ✅ Production использует `/mini-app-react/` (Amvera)

### 3. **Dockerfile**
- ✅ Multi-stage build (Node.js → Nginx)
- ✅ Копирование собранных файлов в `/usr/share/nginx/html`
- ✅ Использование nginx.conf.template с переменными

## 🔧 Переменные окружения

Установите в Amvera:
```
BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
```

## 📦 Процесс деплоя

1. **Локальная сборка:**
```bash
npm run build
```

2. **Проверка файлов:**
```bash
ls -la dist/
# Должны быть: index.html, assets/
```

3. **Коммит и пуш:**
```bash
git add .
git commit -m "fix: исправлена конфигурация nginx для /mini-app-react/"
git push
```

4. **Автоматический деплой:**
- Amvera получит webhook
- Выполнит `npm ci && npm run build`
- Соберет Docker образ с Nginx
- Запустит контейнер

## 🌐 URLs после деплоя

- **Production:** `https://[your-domain].amvera.io/mini-app-react/`
- **Root redirect:** `https://[your-domain].amvera.io/` → `/mini-app-react/`
- **Health check:** `https://[your-domain].amvera.io/health`

## 🔍 Проверка деплоя

1. **Health check:**
```bash
curl https://[your-domain].amvera.io/health
# Должен вернуть: "healthy"
```

2. **Проверка статики:**
```bash
curl https://[your-domain].amvera.io/mini-app-react/
# Должен вернуть HTML страницу
```

3. **Проверка API:**
```bash
curl https://[your-domain].amvera.io/api/health
# Должен проксироваться на бэкенд
```

## ⚠️ Важные моменты

- **НЕ коммитим** `dist/`, `node_modules/`
- **Всегда собирается** на сервере при деплое
- **Nginx автоматически** проксирует API на бэкенд
- **SPA routing** работает через `try_files`

## 🐛 Отладка

Если все еще 500 ошибка:

1. **Проверьте логи Amvera:**
   - Build logs
   - Runtime logs

2. **Проверьте nginx конфигурацию:**
   - Пути к файлам
   - Proxy настройки
   - CORS заголовки

3. **Проверьте переменные окружения:**
   - `BACKEND_URL` установлен
   - URL бэкенда доступен

## ✅ Результат

После успешного деплоя:
- ✅ Сайт доступен по `https://[domain].amvera.io/mini-app-react/`
- ✅ API запросы проксируются на бэкенд
- ✅ SPA routing работает
- ✅ CORS настроен
- ✅ Космическая тема и glassmorphism отображаются