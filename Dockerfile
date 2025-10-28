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
    date

# Собираем приложение
# 1. Очищаем предыдущие сборки (если есть)
# 2. Проверяем TypeScript
# 3. Vite собирает в dist/miniapp/ (согласно vite.config.ts: outDir: '../dist/miniapp')
# 4. Копируем корневой index.html в dist/ для редиректа
RUN rm -rf dist && \
    npx tsc && \
    npx vite build && \
    mkdir -p dist && \
    cp index.html dist/

# Stage 2: Nginx для раздачи статики
FROM nginx:alpine

# Устанавливаем gettext для envsubst
RUN apk add --no-cache gettext

# Создаем директорию для кэша (стандартные пути Nginx)
RUN mkdir -p /var/cache/nginx/api && \
    chown -R nginx:nginx /var/cache/nginx

# Копируем собранные файлы из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем шаблон конфигурации Nginx
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Переменная окружения по умолчанию
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io

# Открываем порт 80
EXPOSE 80

# Подстановка переменных и запуск nginx
CMD /bin/sh -c "envsubst '\$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
