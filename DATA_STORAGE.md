# 💾 Персистентное хранилище `/data`

## 📁 Структура `/data`

```
/data/
├── nginx/
│   ├── cache/              # Proxy cache для API запросов
│   │   ├── 0/
│   │   ├── 1/
│   │   └── ...             # Хеш-структура для быстрого доступа
│   └── temp/               # Временные файлы Nginx
│       ├── client_body/
│       ├── proxy/
│       ├── fastcgi/
│       ├── uwsgi/
│       └── scgi/
└── logs/
    ├── access.log          # Логи доступа
    └── error.log           # Логи ошибок
```

## 🔧 Настройка в Nginx

### Proxy Cache (API запросы)

```nginx
proxy_cache_path /data/nginx/cache 
    levels=1:2              # Двухуровневая структура директорий
    keys_zone=api_cache:10m # 10 МБ для хранения ключей (~80k ключей)
    max_size=500m           # Максимум 500 МБ на диске
    inactive=60m            # Удалять неиспользуемые 60+ минут
    use_temp_path=off;      # Писать напрямую в cache
```

### Что кэшируется

✅ **Кэшируется (10 минут)**:
- `GET /api/stickersets` - список стикерсетов
- `GET /api/stickersets/{id}` - детали стикерсета
- `GET /api/stickersets/search` - поиск
- `GET /api/proxy/stickers/{fileId}` - изображения стикеров

❌ **НЕ кэшируется**:
- `POST/PUT/DELETE` запросы (мутации данных)
- Запросы с `Authorization` header
- Запросы с `Pragma: no-cache`
- `/api/auth/*` - аутентификация (с авторизацией)

### Cache Headers

Проверить статус кэша:
```bash
curl -I https://sticker-art-e13nst.amvera.io/api/stickersets?page=0
```

Response:
```
X-Cache-Status: MISS      # Первый запрос
X-Cache-Status: HIT       # Из кэша
X-Cache-Status: BYPASS    # Кэш пропущен (авторизация)
X-Cache-Status: EXPIRED   # Истекло время
```

## 🐳 Docker Volume

### В Dockerfile

```dockerfile
# Копируем entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Volume монтируется Amvera автоматически
VOLUME ["/data"]

# Entrypoint создает директории при старте
ENTRYPOINT ["/docker-entrypoint.sh"]
```

### docker-entrypoint.sh

**Важно:** Директории создаются **при старте контейнера**, а не при сборке образа!

```bash
#!/bin/sh
# Создаем структуру директорий для /data
mkdir -p /data/nginx/cache/temp \
         /data/nginx/temp/client_body \
         /data/nginx/temp/proxy \
         /data/logs

# Устанавливаем права доступа
chown -R nginx:nginx /data
chmod -R 755 /data

# Подставляем переменные и запускаем nginx
envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
```

### Amvera

Amvera автоматически монтирует `/data` как персистентный volume:
- ✅ Данные сохраняются при рестарте контейнера
- ✅ Данные сохраняются при ребилде образа
- ✅ Данные НЕ удаляются при обновлении кода
- ⚠️ Директории создаются entrypoint'ом при каждом старте

## 📊 Мониторинг

### Проверка размера кэша

```bash
# Через Amvera CLI
amvera exec <project-slug> -- du -sh /data/nginx/cache
```

### Просмотр логов

```bash
# Access log
amvera exec <project-slug> -- tail -f /data/logs/access.log

# Error log
amvera exec <project-slug> -- tail -f /data/logs/error.log

# Или через Amvera logs
amvera logs run <project-slug>
```

### Очистка кэша

```bash
# Полная очистка кэша
amvera exec <project-slug> -- rm -rf /data/nginx/cache/*

# Или перезапуск проекта (кэш пересоздастся)
amvera restart <project-slug>
```

## 🚀 Производительность

### Без кэша
```
API Request → Nginx → Backend API → Response
Time: ~200-500ms (зависит от Backend)
```

### С кэшем (HIT)
```
API Request → Nginx Cache → Response
Time: ~5-20ms (90%+ быстрее!)
```

### Статистика

Ожидаемый cache hit rate:
- **Главная страница**: 80-90% (стикерсеты редко меняются)
- **Поиск**: 60-70% (популярные запросы)
- **Детали стикерсета**: 85-95% (почти статика)

## 🔒 Безопасность

### Разрешения

```bash
# Владелец: nginx:nginx
chown -R nginx:nginx /data

# Права: rwxr-xr-x (755)
chmod -R 755 /data
```

### Логи

- **Access log** - может содержать IP адреса, query params
- **Error log** - может содержать stack traces
- НЕ логируем sensitive data (tokens, passwords)

## 🛠️ Troubleshooting

### Проблема: "Permission denied /data/nginx/cache"

**Причина**: Неправильные права доступа

**Решение**:
```bash
amvera exec <project-slug> -- chown -R nginx:nginx /data
amvera exec <project-slug> -- chmod -R 755 /data
```

### Проблема: Кэш не работает (всегда MISS)

**Проверка 1**: Есть ли заголовки, блокирующие кэш?
```bash
curl -I -H "Pragma: no-cache" https://...  # BYPASS
curl -I -H "Authorization: Bearer xxx" https://...  # BYPASS
```

**Проверка 2**: Правильно ли настроен proxy_cache_path?
```bash
amvera exec <project-slug> -- nginx -T | grep proxy_cache_path
```

### Проблема: Диск заполнен

**Причина**: Кэш вырос больше `max_size=500m`

**Решение 1**: Nginx автоматически удаляет старые файлы (FIFO)

**Решение 2**: Уменьшить `max_size` или `inactive` время:
```nginx
proxy_cache_path /data/nginx/cache 
    max_size=200m      # Было 500m
    inactive=30m;      # Было 60m
```

## 📈 Рекомендации

### Для Production

1. **Мониторинг размера** `/data`:
   ```bash
   # Каждый день проверяйте
   du -sh /data
   ```

2. **Ротация логов** (TODO - добавить logrotate):
   ```bash
   # Вручную можно очистить раз в неделю
   > /data/logs/access.log
   > /data/logs/error.log
   ```

3. **Backup** (если будет SQLite):
   ```bash
   # Копировать /data/db/*.sqlite регулярно
   ```

### Оптимизация кэша

- **Увеличить `inactive`** до 24h для стикерсетов (они редко меняются)
- **Уменьшить для search** до 5m (более динамичный контент)
- **Мониторить hit rate** через logs

### Будущие улучшения

1. **Redis** для session/cache (вместо proxy_cache)
2. **SQLite для favorites** в `/data/db/`
3. **Logrotate** для автоматической очистки логов
4. **Prometheus metrics** из Nginx

## 📚 Ссылки

- [Nginx Proxy Cache](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache)
- [Amvera Persistent Storage](https://docs.amvera.ru/)
- [Docker Volumes](https://docs.docker.com/storage/volumes/)

