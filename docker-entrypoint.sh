#!/bin/sh
set -e

echo "🚀 Starting Nginx with persistent storage setup..."

# Создаем структуру директорий для /data если их нет
# (они могут отсутствовать при первом запуске или если volume не примонтирован)
echo "📁 Creating /data directories..."
mkdir -p /data/nginx/cache/temp \
         /data/nginx/temp/client_body \
         /data/nginx/temp/proxy \
         /data/nginx/temp/fastcgi \
         /data/nginx/temp/uwsgi \
         /data/nginx/temp/scgi \
         /data/logs

# Устанавливаем правильные права доступа
echo "🔒 Setting permissions..."
chown -R nginx:nginx /data
chmod -R 755 /data

# Подставляем переменные окружения в nginx конфиг
echo "⚙️ Configuring nginx with BACKEND_URL=$BACKEND_URL..."
envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Проверяем конфигурацию nginx
echo "✅ Testing nginx configuration..."
nginx -t

# Запускаем nginx
echo "🎉 Starting nginx..."
exec nginx -g 'daemon off;'

