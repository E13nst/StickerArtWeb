# Multi-stage build для React приложения с Nginx

# Stage 1: Build React приложения
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --no-audit

# Копируем исходники
COPY miniapp ./miniapp
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./

# Собираем приложение
# 1. Проверяем TypeScript
# 2. Vite собирает в dist/miniapp/ (согласно vite.config.ts: outDir: '../dist/miniapp')
# 3. Копируем корневой index.html в dist/ для редиректа
RUN npx tsc && npx vite build && \
    mkdir -p dist && \
    cp index.html dist/

# Stage 2: Nginx для раздачи статики
FROM nginx:alpine

# Устанавливаем gettext для envsubst
RUN apk add --no-cache gettext

# Создаем структуру директорий для персистентного хранилища
# /data - монтируется Amvera для постоянного хранения
RUN mkdir -p /data/nginx/cache \
    /data/nginx/temp \
    /data/logs \
    && chown -R nginx:nginx /data \
    && chmod -R 755 /data

# Копируем собранные файлы из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем шаблон конфигурации Nginx
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Переменная окружения по умолчанию
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io

# Открываем порт 80
EXPOSE 80

# Volume для персистентных данных (будет примонтирован Amvera)
VOLUME ["/data"]

# Скрипт для подстановки переменных и запуска nginx
CMD /bin/sh -c "envsubst '\$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
