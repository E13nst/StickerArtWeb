# Multi-stage build для React приложения с Nginx

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
    echo "=== GalleryPage.tsx FIRST 80 LINES ===" && \
    head -80 miniapp/src/pages/GalleryPage.tsx && \
    echo "=== SEARCHING FOR storedInitData ===" && \
    grep -n "storedInitData" miniapp/src/pages/GalleryPage.tsx || echo "NOT FOUND"

# Собираем приложение
# 1. Очищаем предыдущие сборки (если есть)
# 2. Проверяем TypeScript
# 3. Vite собирает в dist/miniapp/ (согласно vite.config.ts: outDir: '../dist/miniapp')
# 4. Копируем корневой index.html в dist/ для редиректа
RUN echo "=== STARTING BUILD ===" && \
    rm -rf dist && \
    echo "dist/ removed" && \
    npx tsc && \
    echo "TypeScript checked" && \
    npx vite build && \
    echo "Vite build completed" && \
    mkdir -p dist && \
    cp index.html dist/ && \
    echo "index.html copied"

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

# Копируем шаблон конфигурации Nginx
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Копируем init-скрипт для проверки /data и инициализации кэша
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Переменная окружения по умолчанию
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io

# Открываем порт 80
EXPOSE 80

# Используем init-скрипт вместо прямого запуска nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
