# Настройка проекта StickerArtWeb

## ✅ Что уже готово

Проект полностью настроен для деплоя на Amvera с использованием Nginx.

## 📦 Файлы проекта

### Конфигурация

- **`Dockerfile`** — multi-stage build (Node.js → Nginx)
- **`nginx.conf`** — конфигурация Nginx (proxy, SPA routing, caching)
- **`amvera.yml`** — конфигурация для Amvera
- **`vite.config.ts`** — настройки Vite (dev proxy, build)

### Приложение

- **`src/`** — исходники React приложения
- **`index.html`** — entry point
- **`package.json`** — зависимости и скрипты

## 🔧 Переменные окружения для Amvera

Добавь в Amvera Console эти переменные (опционально, есть значения по умолчанию):

| Переменная | Значение | Описание |
|------------|----------|----------|
| `BACKEND_URL` | `https://stickerartgallery-e13nst.amvera.io` | URL бэкенд API для проксирования (по умолчанию) |
| `STICKER_PROCESSOR_ORIGIN` | `https://sticker-processor-e13nst.amvera.io` | URL для sticker processor (по умолчанию) |

## 🚀 Команды

### Development
```bash
npm install              # Установка зависимостей
npm run dev              # Запуск dev server (localhost:3000)
```

### Production
```bash
npm run build            # Сборка для продакшена (результат в dist/)
```

## 📋 Workflow деплоя

1. **Разработка локально:**
   ```bash
   npm run dev
   # Изменяешь код, видишь результат сразу
   ```

2. **Коммит:**
   ```bash
   git add .
   git commit -m "feat: your changes"
   git push
   ```

3. **Автоматический деплой:**
   - GitHub webhook → Amvera
   - Amvera выполняет:
     ```bash
     npm ci && npm run build  # Сборка
     docker build             # Docker образ
     docker run               # Запуск Nginx
     ```

## 🌐 Архитектура

```
┌─────────────────────────────────────────┐
│  https://[frontend].amvera.io           │
│  ┌─────────────────────────────────┐    │
│  │  Nginx Container                │    │
│  │  ├── Static files (dist/)       │    │
│  │  └── Proxy /api → Backend       │────┼───┐
│  └─────────────────────────────────┘    │   │
└─────────────────────────────────────────┘   │
                                              │
┌─────────────────────────────────────────┐   │
│  https://stickerartgallery-e13nst...    │◄──┘
│  ┌─────────────────────────────────┐    │
│  │  Spring Boot Container          │    │
│  │  ├── API endpoints (/api)       │    │
│  │  ├── Auth (/auth)               │    │
│  │  └── Database (PostgreSQL)      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## ⚠️ Важные моменты

1. **Не коммитим:** `dist/`, `node_modules/`, `assets/`
2. **Сборка на сервере:** всегда свежая версия
3. **Nginx легковесный:** ~10MB образ против ~500MB Node.js
4. **Независимый деплой:** можно обновлять фронт без бэкенда

## 🔄 Миграция с текущей архитектуры

### До (Monorepo):
- React в `src/main/resources/static/mini-app-react/`
- Собирается локально: `npm run build:prod`
- Коммитим `assets/` (900KB)
- URL: `/mini-app-react/`

### После (Separate frontend):
- React в отдельном проекте `StickerArtWeb/`
- Собирается на Amvera: `npm run build`
- Не коммитим `dist/`
- URL: `/` (корень домена)

## 🎯 Следующие шаги

1. Создать новый проект на Amvera (см. `DEPLOY.md`)
2. Настроить webhook
3. Push в репозиторий
4. Проверить, что всё работает
5. Обновить URL Mini App в BotFather на новый домен

