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

# ✅ ОПТИМИЗАЦИЯ: меняем права только для директорий, не для всех файлов
# При большом кэше (до 2GB) рекурсивный chown/chmod занимал минуты
CACHE_OWNER=$(stat -c '%U' /data/cache/nginx/stickers 2>/dev/null || echo "unknown")
if [ "$CACHE_OWNER" != "nginx" ]; then
    echo "Setting ownership for cache directories..."
    chown nginx:nginx /data/cache /data/cache/nginx /data/cache/nginx/stickers 2>/dev/null || true
    chmod 775 /data/cache /data/cache/nginx 2>/dev/null || true
    chmod 777 /data/cache/nginx/stickers 2>/dev/null || true
else
    echo "Cache directory permissions already correct, skipping..."
fi

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
  "maxSize": "2 GB",
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
  "maxSize": "2 GB",
  "ttl": "14 days",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
fi

echo "=== STARTING NGINX ==="

# Выводим используемые переменные окружения для отладки
echo "Using BACKEND_URL: ${BACKEND_URL}"
echo "Using STICKER_PROCESSOR_ORIGIN: ${STICKER_PROCESSOR_ORIGIN}"

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
  "maxSize": "2 GB",
  "ttl": "14 days",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
        fi
    done
) &

# Запускаем nginx
exec nginx -g 'daemon off;'

