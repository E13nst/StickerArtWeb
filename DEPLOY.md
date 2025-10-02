# Инструкция по деплою на Amvera

## 📋 Шаги для деплоя

### 1. Создать новый проект на Amvera

1. Зайти в [Amvera Console](https://console.amvera.ru/)
2. Нажать "Создать проект"
3. Выбрать "Из Git репозитория"

### 2. Настройки проекта

**Основные настройки:**
- **Название**: `StickerArtWeb` (или любое)
- **Environment**: `Node.js`
- **Версия Node.js**: `18` или `20`

**Repository:**
- **URL**: ваш Git репозиторий
- **Branch**: `main`
- **Path**: `StickerArtWeb/` (если в monorepo) или `/` (если отдельный репо)

**Build:**
- **Build command**: `npm ci && npm run build`
- **Start command**: оставить пустым (Nginx запустится автоматически из Dockerfile)

### 3. Переменные окружения

Добавить в Amvera Console → Settings → Environment Variables:

```bash
BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
```

### 4. Webhook

Настроить GitHub webhook для автоматического деплоя:
- Amvera Console → Settings → Webhooks
- Скопировать URL
- GitHub → Settings → Webhooks → Add webhook
- Paste URL и Save

### 5. Первый деплой

```bash
git add .
git commit -m "feat: setup frontend project"
git push
```

Amvera автоматически:
1. Клонирует репо
2. Выполнит `npm ci && npm run build`
3. Соберет Docker образ (Node.js build → Nginx serve)
4. Запустит контейнер

### 6. Проверка

После деплоя проверить:
- ✅ `https://[your-domain].amvera.io/` — должна загрузиться главная страница
- ✅ `https://[your-domain].amvera.io/health` — должен вернуть "healthy"
- ✅ `/api/*` запросы должны проксироваться на бэкенд

## 🔧 Локальное тестирование Docker

Перед деплоем можно протестировать Docker локально:

```bash
# 1. Собрать образ
docker build -t sticker-art-web .

# 2. Запустить
docker run -p 8080:80 -e BACKEND_URL=https://stickerartgallery-e13nst.amvera.io sticker-art-web

# 3. Открыть http://localhost:8080
```

## 📊 Структура после деплоя

```
Nginx Container
├── /usr/share/nginx/html/
│   ├── index.html
│   └── assets/
│       ├── index-HASH.js
│       └── index-HASH.css
└── /etc/nginx/conf.d/
    └── default.conf (nginx.conf)
```

## 🚨 Troubleshooting

### Проблема: 404 на `/api` запросах
- Проверить `BACKEND_URL` в переменных окружения
- Проверить, что бэкенд доступен

### Проблема: CORS ошибки
- Проверить CORS настройки на бэкенде
- Убедиться, что Nginx передает правильные заголовки

### Проблема: Белый экран
- Проверить console браузера
- Проверить, что `index.html` и assets доступны
- Проверить логи Nginx в Amvera Console

