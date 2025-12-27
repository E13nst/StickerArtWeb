# Sticker Art Gallery - Frontend

React приложение для Telegram Mini App галереи стикеров.

## 🚀 Быстрый старт

### Development

```bash
# Установка зависимостей
npm install

# Запуск dev server (proxy к бэкенду)
npm run dev

# Открыть http://localhost:3000
```

### Production Build

```bash
npm run build
# Результат в dist/
```

## 📦 Деплой на Amvera

### Требования:
- **Environment**: Node.js
- **Toolchain**: Nginx

### Переменные окружения:

| Переменная | Описание | Пример |
|------------|----------|--------|
| `BACKEND_URL` | URL бэкенд API | `https://stickerartgallery-e13nst.amvera.io` |
| `STICKER_PROCESSOR_ORIGIN` | URL для sticker processor | `https://sticker-processor-e13nst.amvera.io` |

**Примечание:** Обе переменные имеют значения по умолчанию в `docker-entrypoint.sh` и `Dockerfile`.

### Процесс деплоя:

1. **Создать проект на Amvera**:
   - Тип: Node.js + Nginx
   - Repository: этот проект
   - Build command: `npm ci && npm run build`
   - Start command: Nginx (автоматически)

2. **Установить переменные окружения**:
   ```
   BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
   ```

3. **Push в репозиторий**:
   ```bash
   git push
   ```

4. **Webhook автоматически задеплоит**:
   - `npm ci` — установка зависимостей
   - `npm run build` — сборка в `dist/`
   - Nginx раздает `dist/` по корню
   - API запросы проксируются на `BACKEND_URL`

## 🔧 Конфигурация

### `nginx.conf`
- Раздача статики из `/usr/share/nginx/html`
- Proxy `/api` → `$BACKEND_URL/api`
- Proxy `/auth` → `$BACKEND_URL/auth`
- SPA routing (все запросы → `index.html`)
- Кеширование assets (1 год)
- Gzip compression

### `vite.config.ts`
- Dev server на порту 3000
- Proxy к бэкенду (через `VITE_BACKEND_URL`)
- Base path: `/` (корень домена)

## 🌐 URLs

После деплоя приложение будет доступно по:
- **Production**: `https://[your-domain].amvera.io/`
- **Development**: `http://localhost:3000/`

## 📋 Структура

```
StickerArtWeb/
├── src/                 # Исходники React
├── public/              # Статические файлы
├── index.html           # Entry point
├── vite.config.ts       # Vite конфигурация
├── nginx.conf           # Nginx конфигурация
├── Dockerfile           # Multi-stage build (Node.js + Nginx)
├── amvera.yml           # Конфигурация для Amvera
└── package.json         # Dependencies
```

## 🔄 Workflow

1. **Локальная разработка**:
   ```bash
   npm run dev
   # Hot reload работает
   # API проксируется на бэкенд
   ```

2. **Коммит изменений**:
   ```bash
   git add .
   git commit -m "feat: your changes"
   git push
   ```

3. **Автоматический деплой**:
   - GitHub webhook → Amvera
   - Amvera собирает Docker образ
   - Nginx раздает новую версию

## ⚠️ Важно!

- **НЕ коммитим** `dist/`, `node_modules/`, `assets/`
- **Всегда собирается** на сервере при деплое
- **Nginx** автоматически проксирует API на бэкенд
