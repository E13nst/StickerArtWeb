#!/bin/sh
set -e

echo "=== AMVERA /data STORAGE CHECK ==="

# Проверяем доступность /data директории
if [ -d "/data" ]; then
    echo "✅ /data directory exists"
    ls -la /data || true
else
    echo "⚠️  /data directory does NOT exist - creating..."
    mkdir -p /data
fi

# Создаем тестовый файл для проверки persistence
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "Deploy timestamp: ${TIMESTAMP}" > /data/test.txt
echo "Container hostname: $(hostname)" >> /data/test.txt
echo "Container IP: $(hostname -i 2>/dev/null || echo 'N/A')" >> /data/test.txt
echo "✅ Created /data/test.txt with timestamp"

# Показываем содержимое тестового файла
echo "=== /data/test.txt content ==="
cat /data/test.txt

# Создаем директорию для Nginx кэша с правильными правами
echo "=== CREATING NGINX CACHE DIRECTORY ==="
mkdir -p /data/cache/nginx/stickers
chown -R nginx:nginx /data/cache
chmod -R 755 /data/cache

# Проверяем финальное состояние /data
echo "=== FINAL /data STATE ==="
ls -lah /data/
ls -lah /data/cache/ 2>/dev/null || echo "Cache directory will be created by nginx"

echo "=== CHECKING NGINX CACHE STATS ==="
if [ -d "/data/cache/nginx/stickers" ]; then
    CACHE_SIZE=$(du -sh /data/cache/nginx/stickers 2>/dev/null | cut -f1 || echo "0")
    CACHE_FILES=$(find /data/cache/nginx/stickers -type f 2>/dev/null | wc -l || echo "0")
    echo "Cache size: ${CACHE_SIZE}"
    echo "Cached files: ${CACHE_FILES}"
else
    echo "Cache directory empty (first deploy or cleared)"
fi

echo "=== STARTING NGINX ==="

# Подставляем переменные окружения в nginx конфиг
envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Проверяем конфигурацию nginx
nginx -t

# Запускаем nginx
exec nginx -g 'daemon off;'

