# ⚙️ Настройка Amvera через UI

## 🔧 Переменные окружения

### Как добавить через UI:

1. Открой проект в Amvera: https://console.amvera.ru/
2. Перейди в **Settings** → **Environment Variables**
3. Добавь переменную:
   - **Name**: `BACKEND_URL`
   - **Value**: `https://stickerartgallery-e13nst.amvera.io`
4. Нажми **Save**
5. **Restart** проект для применения изменений

### Альтернативно через CLI:

```bash
# Логин
amvera login

# Добавить переменную
amvera env add sticker-art-e13nst BACKEND_URL https://stickerartgallery-e13nst.amvera.io

# Рестарт проекта
amvera restart sticker-art-e13nst
```

## 💾 Персистентное хранилище `/data`

### Автоматическое монтирование

Amvera **автоматически монтирует `/data`** как persistent volume:
- ✅ Не требует настройки в UI
- ✅ Автоматически создается при первом деплое
- ✅ Сохраняется при рестартах и ребилдах
- ✅ Размер: обычно 1-5 GB (зависит от тарифа)

### Проверка через CLI:

```bash
# Подключиться к контейнеру
amvera exec sticker-art-e13nst -- /bin/sh

# Внутри контейнера:
ls -la /data
du -sh /data/*

# Выход
exit
```

### Что хранится в `/data`:

```
/data/
├── nginx/
│   ├── cache/          # Proxy cache (API responses)
│   └── temp/           # Временные файлы Nginx
└── logs/
    ├── access.log      # Access logs
    └── error.log       # Error logs
```

## 📊 Мониторинг

### Просмотр логов через UI:

1. Открой проект в Amvera
2. **Logs** → **Runtime Logs**
3. Выбери:
   - **Build logs** - логи сборки Docker
   - **Run logs** - логи работы Nginx + приложения

### Просмотр логов через CLI:

```bash
# Build logs
amvera logs build sticker-art-e13nst

# Runtime logs (Nginx + приложение)
amvera logs run sticker-art-e13nst

# Следить за логами в реальном времени
amvera logs run sticker-art-e13nst --follow
```

### Кастомные логи из `/data`:

```bash
# Access log
amvera exec sticker-art-e13nst -- tail -f /data/logs/access.log

# Error log
amvera exec sticker-art-e13nst -- tail -f /data/logs/error.log
```

## 🚀 Деплой процесс

### Автоматический деплой (через Git):

```bash
# 1. Коммит изменений
git add .
git commit -m "feat: add nginx caching"
git push origin main

# 2. Amvera автоматически:
# - Получает изменения из GitHub
# - Запускает docker build
# - Создает новый контейнер
# - Переключает трафик на новый контейнер
# - Старый контейнер удаляется

# 3. Проверяем статус
amvera describe project sticker-art-e13nst
```

### Ручной ребилд (через CLI):

```bash
# Пересобрать и задеплоить
amvera rebuild sticker-art-e13nst

# Просто рестарт (без ребилда)
amvera restart sticker-art-e13nst
```

## 🔄 Обновление конфигурации

### После изменения `nginx.conf.template`:

```bash
git add nginx.conf.template
git commit -m "fix: update nginx cache settings"
git push origin main

# Amvera автоматически пересоберет
```

### После изменения `Dockerfile`:

```bash
git add Dockerfile
git commit -m "feat: add /data volume"
git push origin main

# Amvera автоматически пересоберет
```

### Проверка конфигурации Nginx:

```bash
# Подключиться к контейнеру
amvera exec sticker-art-e13nst -- /bin/sh

# Проверить конфиг
nginx -t

# Посмотреть финальный конфиг (с подстановкой $BACKEND_URL)
cat /etc/nginx/conf.d/default.conf
```

## 🛠️ Troubleshooting

### Проблема: Переменная окружения не применилась

**Решение**:
```bash
# 1. Проверь что добавлена в UI
# 2. Рестартни проект
amvera restart sticker-art-e13nst

# 3. Проверь внутри контейнера
amvera exec sticker-art-e13nst -- env | grep BACKEND_URL
```

### Проблема: `/data` не создается или ошибка `mkdir() "/data/nginx/cache" failed (2: No such file or directory)`

**Причина**: Директории создаются при сборке образа, а не при старте контейнера

**Решение**: Используем entrypoint script

В `Dockerfile`:
```dockerfile
# Копируем entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

VOLUME ["/data"]
ENTRYPOINT ["/docker-entrypoint.sh"]
```

В `docker-entrypoint.sh`:
```bash
#!/bin/sh
# Создаем директории при СТАРТЕ контейнера
mkdir -p /data/nginx/cache/temp /data/nginx/temp /data/logs
chown -R nginx:nginx /data
chmod -R 755 /data

# Запускаем nginx
exec nginx -g 'daemon off;'
```

**Почему это важно?**
- ❌ `RUN mkdir` в Dockerfile - создает при **сборке** образа (volume еще не примонтирован)
- ✅ `mkdir` в entrypoint - создает при **старте** контейнера (volume уже примонтирован)

### Проблема: Логи не пишутся в `/data/logs`

**Проверка прав**:
```bash
amvera exec sticker-art-e13nst -- ls -la /data/logs

# Должно быть: drwxr-xr-x nginx nginx
```

**Решение**:
```bash
amvera exec sticker-art-e13nst -- chown -R nginx:nginx /data
amvera restart sticker-art-e13nst
```

### Проблема: Кэш не работает

**Проверка 1**: Правильно ли настроен proxy_cache_path?
```bash
amvera exec sticker-art-e13nst -- nginx -T | grep proxy_cache_path
```

**Проверка 2**: Создалась ли директория кэша?
```bash
amvera exec sticker-art-e13nst -- ls -la /data/nginx/cache
```

**Проверка 3**: Есть ли header X-Cache-Status?
```bash
curl -I https://sticker-art-e13nst.amvera.io/api/stickersets
# Должен быть: X-Cache-Status: MISS (первый раз) или HIT
```

## 📈 Оптимизация

### Увеличение размера кэша:

Если нужно больше места для кэша, отредактируй `nginx.conf.template`:

```nginx
proxy_cache_path /data/nginx/cache 
    max_size=1g      # Было 500m, стало 1GB
    inactive=120m;   # Было 60m, стало 2 часа
```

Затем:
```bash
git add nginx.conf.template
git commit -m "chore: increase cache size"
git push
```

### Очистка старых логов:

```bash
# Очистить access log
amvera exec sticker-art-e13nst -- sh -c "> /data/logs/access.log"

# Очистить error log
amvera exec sticker-art-e13nst -- sh -c "> /data/logs/error.log"
```

### Мониторинг размера `/data`:

```bash
# Общий размер
amvera exec sticker-art-e13nst -- du -sh /data

# По директориям
amvera exec sticker-art-e13nst -- du -sh /data/*

# Детально
amvera exec sticker-art-e13nst -- du -h /data/nginx/cache | tail -20
```

## 🔒 Безопасность

### Логи могут содержать:

- ✅ IP адреса пользователей
- ✅ Query параметры URL
- ✅ User-Agent strings
- ❌ НЕ должны содержать: токены, пароли, sensitive data

### Ротация логов:

Пока ручная очистка раз в неделю/месяц:
```bash
# Backup логов (опционально)
amvera exec sticker-art-e13nst -- tar -czf /data/logs-backup-$(date +%Y%m%d).tar.gz /data/logs/*.log

# Очистка
amvera exec sticker-art-e13nst -- sh -c "> /data/logs/access.log"
amvera exec sticker-art-e13nst -- sh -c "> /data/logs/error.log"
```

## 📚 Полезные команды

```bash
# Статус проекта
amvera describe project sticker-art-e13nst

# Рестарт
amvera restart sticker-art-e13nst

# Ребилд
amvera rebuild sticker-art-e13nst

# Логи build
amvera logs build sticker-art-e13nst

# Логи runtime
amvera logs run sticker-art-e13nst --follow

# Exec команда
amvera exec sticker-art-e13nst -- <command>

# Переменные окружения
amvera get env sticker-art-e13nst
amvera env add sticker-art-e13nst KEY VALUE
amvera env update sticker-art-e13nst KEY NEW_VALUE
amvera env delete sticker-art-e13nst KEY
```

## 🎯 Чеклист после деплоя

- [ ] Проверить что `BACKEND_URL` добавлен в UI
- [ ] Проверить что `/data` создан: `amvera exec ... -- ls -la /data`
- [ ] Проверить логи: `amvera logs run ...`
- [ ] Проверить кэш работает: `curl -I ... | grep X-Cache-Status`
- [ ] Открыть сайт: https://sticker-art-e13nst.amvera.io/miniapp/
- [ ] Проверить что стикеры загружаются
- [ ] Запустить E2E тесты: `npm run test:prod`

