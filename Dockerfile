# Multi-stage build для React приложения с Nginx
# syntax=docker/dockerfile:1.4

# Stage 1: Build React приложения
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости с кешированием npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Копируем исходники
COPY . .

# Собираем приложение
RUN npm run build

# Stage 2: Nginx для раздачи статики
FROM nginx:alpine

# Устанавливаем gettext для envsubst
RUN apk add --no-cache gettext

# Копируем собранные файлы из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем шаблон конфигурации Nginx
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Переменная окружения по умолчанию
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io

# Открываем порт 80
EXPOSE 80

# Скрипт для подстановки переменных и запуска nginx
CMD /bin/sh -c "envsubst '\$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"

