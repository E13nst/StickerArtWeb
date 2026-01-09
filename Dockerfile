# Multi-stage build для React приложения с Nginx
# FORCE REBUILD: 2026-01-09T13:30:00Z - cache invalidation

# Stage 1: Build React приложения
FROM node:18-alpine AS builder

WORKDIR /app

# Cache busting argument (можно передать при сборке для форсирования rebuild)
ARG CACHEBUST=1

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --no-audit

# Копируем исходники
COPY miniapp ./miniapp
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./

# Выводим информацию о сборке для отладки
RUN echo "=== BUILD INFO ===" && \
    echo "CACHEBUST: ${CACHEBUST}" && \
    echo "NODE_VERSION: $(node --version)" && \
    echo "NPM_VERSION: $(npm --version)" && \
    echo "BUILD_TIME: $(date)" && \
    echo "BUILD_TIMESTAMP: $(date +%s)"

# Debug: Показываем что в директории до сборки
RUN echo "=== FILES BEFORE BUILD ===" && \
    ls -la miniapp/src/pages/ && \
    echo "=== CHECKING FOR GeneratePage.tsx ===" && \
    (test -f miniapp/src/pages/GeneratePage.tsx && echo "✅ GeneratePage.tsx EXISTS" || echo "❌ GeneratePage.tsx MISSING") && \
    echo "=== BottomNav.tsx NAVIGATION ACTIONS ===" && \
    grep -n "BottomNavigationAction" miniapp/src/components/BottomNav.tsx | head -10

# Собираем приложение
# 1. Очищаем предыдущие сборки (если есть)
# 2. Проверяем TypeScript
# 3. Vite собирает в dist/miniapp/ (согласно vite.config.ts: outDir: '../dist/miniapp')
RUN echo "=== STARTING BUILD ===" && \
    rm -rf dist && \
    echo "dist/ removed" && \
    npx tsc && \
    echo "TypeScript checked" && \
    npx vite build && \
    echo "Vite build completed" && \
    mkdir -p dist && \
    echo "Build ID: $(date -u +'%Y-%m-%dT%H:%M:%SZ') | CACHEBUST=${CACHEBUST} | node=$(node --version) | npm=$(npm --version)" > dist/build.txt && \
    mkdir -p dist/miniapp && \
    echo "Build ID: $(date -u +'%Y-%m-%dT%H:%M:%SZ') | CACHEBUST=${CACHEBUST} | node=$(node --version) | npm=$(npm --version)" > dist/miniapp/build.txt && \
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/miniapp/"><title>Redirecting...</title></head><body><p>Redirecting to <a href="/miniapp/">Sticker Gallery</a>...</p></body></html>' > dist/index.html && \
    echo "Redirect index.html created"

# Debug: Показываем что получилось после сборки
RUN echo "=== FILES AFTER BUILD ===" && \
    ls -la dist/ && \
    ls -la dist/miniapp/ && \
    echo "=== BUILT JS FILES ===" && \
    ls -lh dist/miniapp/assets/*.js | head -10 && \
    echo "=== CHECKING FOR storedInitData IN BUILT FILES ===" && \
    grep -r "storedInitData" dist/miniapp/ || echo "NOT FOUND IN BUILT FILES"

# Stage 2: Nginx для раздачи статики
FROM nginx:alpine

# Устанавливаем gettext для envsubst
RUN apk add --no-cache gettext

# Создаем директорию для постоянного кэша в /data (persistent storage на Amvera)
# /data сохраняется между деплоями, в отличие от /var/cache
RUN mkdir -p /data/cache/nginx/stickers && \
    chown -R nginx:nginx /data/cache

# Копируем собранные файлы из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем страницу статистики кэша
COPY public/cache-stats.html /usr/share/nginx/html/cache-stats.html

# Копируем конфиг Nginx (шаблон для envsubst)
COPY nginx.conf /etc/nginx/conf.d/app.conf.tpl

# Копируем init-скрипт для проверки /data и инициализации кэша
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Переменная окружения по умолчанию
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
ENV STICKER_PROCESSOR_ORIGIN=https://sticker-processor-e13nst.amvera.io

# Открываем порт 80
EXPOSE 80

# Используем init-скрипт вместо прямого запуска nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
