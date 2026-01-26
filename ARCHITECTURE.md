# Архитектура проекта: работа на хостинге и взаимодействие с бэкендом

```typescript
/**
 * ============================================================================
 * АРХИТЕКТУРА ПРОЕКТА: ХОСТИНГ И БЭКЕНД
 * ============================================================================
 * 
 * 1. СТРУКТУРА ПРОЕКТА
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │  React Frontend (Telegram Mini App)                         │
 *    │  - Vite build → dist/miniapp/                               │
 *    │  - Base path: /miniapp/                                     │
 *    │  - API client: baseURL = '/api' (относительный путь)        │
 *    └─────────────────────────────────────────────────────────────┘
 *                            │
 *                            │ HTTP запросы
 *                            ▼
 *    ┌─────────────────────────────────────────────────────────────┐
 *    │  Nginx (Amvera хостинг)                                      │
 *    │  - Порт: 80                                                  │
 *    │  - Статика: /usr/share/nginx/html/                          │
 *    │  - Проксирование API запросов                                │
 *    └─────────────────────────────────────────────────────────────┘
 *                            │
 *        ┌──────────────────┴──────────────────┐
 *        │                                       │
 *        ▼                                       ▼
 *    ┌──────────────┐                  ┌──────────────────────┐
 *    │  Backend API │                  │  Sticker Processor   │
 *    │  (Amvera)    │                  │  (Amvera)            │
 *    │              │                  │                      │
 *    │  /api/*      │                  │  /stickers/*        │
 *    │  /auth/*     │                  │                      │
 *    └──────────────┘                  └──────────────────────┘
 * 
 * 
 * 2. ПРОЦЕСС ДЕПЛОЯ (Amvera)
 * 
 *    GitHub Push → Webhook → Amvera автоматически:
 *    
 *    a) Клонирует репозиторий
 *    b) Выполняет: npm ci && npm run build
 *       - TypeScript проверка (npx tsc)
 *       - Vite сборка в dist/miniapp/
 *       - Создание build.txt с метаданными
 *    
 *    c) Docker multi-stage build:
 *       Stage 1 (builder):
 *         - FROM node:18-alpine
 *         - npm ci --no-audit
 *         - npx tsc && npx vite build
 *         - Результат: dist/miniapp/ с assets/
 *       
 *       Stage 2 (nginx):
 *         - FROM nginx:alpine
 *         - Копирует dist/ → /usr/share/nginx/html/
 *         - Копирует nginx.conf → /etc/nginx/conf.d/app.conf.tpl
 *         - Копирует docker-entrypoint.sh
 *         - ENV: BACKEND_URL, STICKER_PROCESSOR_ORIGIN
 *     
 *    d) Запуск контейнера:
 *       - docker-entrypoint.sh:
 *         * Проверяет /data (persistent storage)
 *         * Создает /data/cache/nginx/stickers (кэш стикеров)
 *         * envsubst подставляет переменные в nginx.conf
 *         * Запускает nginx -g 'daemon off;'
 * 
 * 
 * 3. NGINX КОНФИГУРАЦИЯ (nginx.conf)
 * 
 *    a) Проксирование API запросов:
 *       location /api {
 *         proxy_pass ${BACKEND_URL};  // → https://stickerartgallery-e13nst.amvera.io
 *         // Передает заголовки: X-Telegram-Init-Data, X-Language
 *         // CORS заголовки для кросс-доменных запросов
 *       }
 *    
 *    b) Проксирование стикеров:
 *       location ~ ^/stickers/[^/]+$ {
 *         proxy_pass ${STICKER_PROCESSOR_ORIGIN};  // → https://sticker-processor-e13nst.amvera.io
 *         proxy_cache sticker_cache;  // Кэш в /data/cache/nginx/stickers
 *         proxy_cache_valid 200 14d;   // Кэш на 14 дней
 *         proxy_cache_max_size 5g;     // Максимум 5GB
 *       }
 *    
 *    c) Раздача статики:
 *       location /miniapp/ {
 *         root /usr/share/nginx/html;
 *         try_files $uri /miniapp/index.html;  // SPA routing
 *         // HTML не кэшируется (no-cache)
 *         // Assets с хэшами кэшируются 1 год (immutable)
 *       }
 *    
 *    d) Кэширование:
 *       - HTML файлы: no-cache (обновления сразу)
 *       - Assets с хэшами (vendor-XXX.js): 1 год (immutable)
 *       - Стикеры: 14 дней в /data/cache/nginx/stickers
 * 
 * 
 * 4. API CLIENT (miniapp/src/api/client.ts)
 * 
 *    class ApiClient {
 *      private client: AxiosInstance;
 *      
 *      constructor() {
 *        this.client = axios.create({
 *          baseURL: '/api',  // Относительный путь → Nginx проксирует
 *          timeout: 30000,
 *          headers: {
 *            'Content-Type': 'application/json',
 *            'X-Telegram-Init-Data': initData,  // Из Telegram WebApp
 *            'X-Language': 'ru' | 'en'
 *          }
 *        });
 *      }
 *      
 *      // Все методы делают запросы к /api/*
 *      // Nginx автоматически проксирует на BACKEND_URL
 *      
 *      async getStickerSets() {
 *        // GET /api/stickersets → Nginx → Backend
 *        return this.client.get('/stickersets');
 *      }
 *      
 *      async checkAuthStatus() {
 *        // GET /api/auth/status → Nginx → Backend
 *        return this.client.get('/auth/status');
 *      }
 *    }
 * 
 * 
 * 5. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
 * 
 *    Amvera Console → Environment Variables:
 *    
 *    BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
 *      - Используется в nginx.conf для proxy_pass /api
 *      - Значение по умолчанию в Dockerfile
 *    
 *    STICKER_PROCESSOR_ORIGIN=https://sticker-processor-e13nst.amvera.io
 *      - Используется в nginx.conf для proxy_pass /stickers
 *      - Значение по умолчанию в Dockerfile
 *    
 *    VITE_BACKEND_URL (только для dev)
 *      - Используется в vite.config.ts для dev server proxy
 *      - Не нужен в production (Nginx проксирует)
 * 
 * 
 * 6. ПОТОК ЗАПРОСА
 * 
 *    Пользователь → Telegram Mini App:
 *    
 *    1. Браузер запрашивает: https://your-domain.amvera.io/miniapp/
 *       → Nginx отдает index.html из /usr/share/nginx/html/miniapp/
 *    
 *    2. React загружает: /miniapp/assets/index-XXX.js
 *       → Nginx отдает из кэша (1 год) или с диска
 *    
 *    3. React делает API запрос: GET /api/stickersets
 *       → Nginx перехватывает /api/*
 *       → proxy_pass на BACKEND_URL/api/stickersets
 *       → Backend обрабатывает запрос
 *       → Возвращает JSON
 *       → Nginx передает ответ клиенту
 *    
 *    4. React загружает стикер: GET /stickers/ABC123?file=true
 *       → Nginx перехватывает /stickers/*
 *       → Проверяет кэш в /data/cache/nginx/stickers
 *       → Если есть → отдает из кэша (X-Cache-Status: HIT)
 *       → Если нет → proxy_pass на STICKER_PROCESSOR_ORIGIN
 *       → Сохраняет в кэш (14 дней)
 *       → Отдает клиенту
 * 
 * 
 * 7. КЭШИРОВАНИЕ
 * 
 *    a) Nginx кэш стикеров:
 *       - Путь: /data/cache/nginx/stickers (persistent на Amvera)
 *       - TTL: 14 дней
 *       - Максимум: 5GB
 *       - Ключ: $scheme$request_method$host$request_uri
 *       - Статистика: /api/cache-info (JSON)
 *    
 *    b) Браузерный кэш:
 *       - HTML: no-cache (всегда свежий)
 *       - Assets с хэшами: 1 год (immutable)
 *       - Стикеры: 14 дней (Cache-Control header)
 *    
 *    c) API Client кэш (в памяти):
 *       - requestDeduplicator: предотвращает дублирующиеся запросы
 *       - TTL: 5 минут для большинства запросов
 *       - Не кэширует: likedOnly, auth запросы
 * 
 * 
 * 8. АВТОРИЗАЦИЯ
 * 
 *    Telegram Mini App передает initData через:
 *    
 *    a) Заголовок X-Telegram-Init-Data в каждом API запросе
 *    b) Nginx проксирует заголовок на Backend
 *    c) Backend валидирует initData и извлекает userId
 *    d) Backend возвращает профиль пользователя
 *    
 *    Пример:
 *      Frontend: apiClient.setAuthHeaders(telegram.initData)
 *      → Axios добавляет: X-Telegram-Init-Data: <initData>
 *      → Nginx проксирует заголовок
 *      → Backend: /api/auth/status проверяет initData
 *      → Возвращает: { userId, username, ... }
 * 
 * 
 * 9. ЛОКАЛЬНАЯ РАЗРАБОТКА
 * 
 *    npm run dev:
 *      - Vite dev server на порту 3000
 *      - vite.config.ts: proxy /api → VITE_BACKEND_URL
 *      - vite.config.ts: proxy /stickers → VITE_STICKER_PROCESSOR_PROXY_TARGET
 *      - Hot reload работает
 *      - Нет Nginx, проксирование через Vite
 * 
 * 
 * 10. ПРОИЗВОДИТЕЛЬНОСТЬ
 * 
 *     a) Code splitting (vite.config.ts):
 *        - vendor.js: React, MUI, Zustand (один chunk)
 *        - lottie-vendor.js: Lottie отдельно (~300KB)
 *        - page-*.js: каждая страница отдельно
 *        - modals.js: модальные окна по требованию
 *        - gallery-heavy.js: тяжелые компоненты галереи
 *     
 *     b) Оптимизации:
 *        - Gzip compression (Nginx)
 *        - Asset кэширование (1 год для хэшированных файлов)
 *        - Nginx кэш стикеров (14 дней, 5GB)
 *        - Request deduplication (предотвращает дубли)
 *        - Virtual scrolling для больших списков
 * 
 * 
 * 11. МОНИТОРИНГ И ДИАГНОСТИКА
 * 
 *     - /health: health check endpoint
 *     - /build.txt: версия сборки
 *     - /cache-stats: статистика кэша (HTML)
 *     - /api/cache-info: статистика кэша (JSON)
 *     - Nginx логи: /var/log/nginx/error.log, cache_stats.log
 *     - X-Cache-Status header: показывает статус кэша (HIT/MISS/BYPASS)
 * 
 * 
 * ============================================================================
 * ИТОГОВАЯ СХЕМА ВЗАИМОДЕЙСТВИЯ
 * ============================================================================
 * 
 *    [Telegram WebApp]
 *           │
 *           │ HTTPS
 *           ▼
 *    [Nginx (Amvera)]
 *           │
 *           ├─→ /miniapp/* → Статика из /usr/share/nginx/html/miniapp/
 *           │
 *           ├─→ /api/* → proxy_pass → [Backend API]
 *           │              │
 *           │              └─→ Валидация initData, бизнес-логика, БД
 *           │
 *           └─→ /stickers/* → proxy_pass → [Sticker Processor]
 *                              │
 *                              └─→ Загрузка стикеров из Telegram
 *                              └─→ Кэш в /data/cache/nginx/stickers
 * 
 * ============================================================================
 */
```
