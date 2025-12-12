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

# Создаем директорию для Nginx кэша с правильными правами
echo "=== CREATING NGINX CACHE DIRECTORY ==="
mkdir -p /data/cache/nginx/stickers
chown -R nginx:nginx /data/cache
# ✅ ИСПРАВЛЕНО: даем права на запись для nginx (775 для директорий, 777 для кеша)
chmod -R 775 /data/cache
# ✅ ДОБАВЛЕНО: явно устанавливаем права на директорию кеша для записи
chmod 777 /data/cache/nginx/stickers 2>/dev/null || true

# Проверяем финальное состояние /data
echo "=== FINAL /data STATE ==="
ls -lah /data/
ls -lah /data/cache/ 2>/dev/null || echo "Cache directory will be created by nginx"

echo "=== CHECKING NGINX CACHE STATS ==="
if [ -d "/data/cache/nginx/stickers" ]; then
    CACHE_SIZE=$(du -sh /data/cache/nginx/stickers 2>/dev/null | cut -f1 || echo "0")
    CACHE_FILES=$(find /data/cache/nginx/stickers -type f 2>/dev/null | wc -l || echo "0")
    CACHE_SIZE_BYTES=$(du -sb /data/cache/nginx/stickers 2>/dev/null | cut -f1 || echo "0")
    echo "Cache size: ${CACHE_SIZE}"
    echo "Cached files: ${CACHE_FILES}"
    
    # Создаем JSON файл со статистикой кэша
    cat > /usr/share/nginx/html/cache-info.json <<EOF
{
  "fileCount": ${CACHE_FILES},
  "cacheSize": "${CACHE_SIZE}",
  "cacheSizeBytes": ${CACHE_SIZE_BYTES},
  "cachePath": "/data/cache/nginx/stickers",
  "maxSize": "5 GB",
  "ttl": "14 days",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    echo "✅ Cache info JSON created at /usr/share/nginx/html/cache-info.json"
else
    echo "Cache directory empty (first deploy or cleared)"
    # Создаем пустой JSON файл
    cat > /usr/share/nginx/html/cache-info.json <<EOF
{
  "fileCount": 0,
  "cacheSize": "0",
  "cacheSizeBytes": 0,
  "cachePath": "/data/cache/nginx/stickers",
  "maxSize": "5 GB",
  "ttl": "14 days",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
fi

echo "=== STARTING NGINX ==="

# Подставляем переменные окружения в nginx конфиг
envsubst '$BACKEND_URL $STICKER_PROCESSOR_ORIGIN' < /etc/nginx/conf.d/app.conf.tpl > /etc/nginx/conf.d/default.conf

# Проверяем конфигурацию nginx
nginx -t

# Запускаем фоновый процесс для периодического обновления статистики кэша
(
    while true; do
        sleep 60  # Обновляем каждую минуту
        if [ -d "/data/cache/nginx/stickers" ]; then
            CACHE_SIZE=$(du -sh /data/cache/nginx/stickers 2>/dev/null | cut -f1 || echo "0")
            CACHE_FILES=$(find /data/cache/nginx/stickers -type f 2>/dev/null | wc -l || echo "0")
            CACHE_SIZE_BYTES=$(du -sb /data/cache/nginx/stickers 2>/dev/null | cut -f1 || echo "0")
            cat > /usr/share/nginx/html/cache-info.json <<EOF
{
  "fileCount": ${CACHE_FILES},
  "cacheSize": "${CACHE_SIZE}",
  "cacheSizeBytes": ${CACHE_SIZE_BYTES},
  "cachePath": "/data/cache/nginx/stickers",
  "maxSize": "5 GB",
  "ttl": "14 days",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
        fi
    done
) &

# Запускаем nginx
exec nginx -g 'daemon off;'

