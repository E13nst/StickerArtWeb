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

## 🗂️ Кэширование и логи

### Nginx Cache

Используются **стандартные пути Nginx**:
- ✅ Кэш API: `/var/cache/nginx/api` (500 MB max, 10 минут для 200 OK)
- ✅ Логи: `/var/log/nginx/access.log` и `/var/log/nginx/error.log`
- ⚠️ Данные **не сохраняются** при рестарте контейнера (ephemeral storage)

### Проверка кэша:

```bash
# Подключиться к контейнеру
amvera exec sticker-art-e13nst -- /bin/sh

# Внутри контейнера:
ls -la /var/cache/nginx/api
du -sh /var/cache/nginx/api

# Выход
exit
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

### Nginx логи:

```bash
# Access log
amvera exec sticker-art-e13nst -- tail -f /var/log/nginx/access.log

# Error log
amvera exec sticker-art-e13nst -- tail -f /var/log/nginx/error.log
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

### После изменения `nginx.conf`:

```bash
git add nginx.conf
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

### Проблема: Nginx не стартует

**Проверка логов**:
```bash
# Build logs
amvera logs build sticker-art-e13nst

# Runtime logs
amvera logs run sticker-art-e13nst
```

**Проверка конфига**:
```bash
amvera exec sticker-art-e13nst -- nginx -t
```

### Проблема: Кэш не работает

**Проверка 1**: Правильно ли настроен proxy_cache_path?
```bash
amvera exec sticker-art-e13nst -- nginx -T | grep proxy_cache_path
```

**Проверка 2**: Создалась ли директория кэша?
```bash
amvera exec sticker-art-e13nst -- ls -la /var/cache/nginx/api
```

**Проверка 3**: Есть ли header X-Cache-Status?
```bash
curl -I https://sticker-art-e13nst.amvera.io/api/stickersets
# Должен быть: X-Cache-Status: MISS (первый раз) или HIT
```

## 📈 Оптимизация

### Увеличение размера кэша:

Если нужно больше места для кэша, отредактируй `nginx.conf`:

```nginx
proxy_cache_path /data/nginx/cache 
    max_size=1g      # Было 500m, стало 1GB
    inactive=120m;   # Было 60m, стало 2 часа
```

Затем:
```bash
git add nginx.conf
git commit -m "chore: increase cache size"
git push
```

### Очистка кэша:

```bash
# Очистить кэш API
amvera exec sticker-art-e13nst -- rm -rf /var/cache/nginx/api/*

# Рестарт nginx для применения
amvera restart sticker-art-e13nst
```

### Мониторинг размера кэша:

```bash
# Размер кэша
amvera exec sticker-art-e13nst -- du -sh /var/cache/nginx/api

# Детально
amvera exec sticker-art-e13nst -- du -h /var/cache/nginx/api | tail -20
```

## 🔒 Безопасность

### Логи могут содержать:

- ✅ IP адреса пользователей
- ✅ Query параметры URL
- ✅ User-Agent strings
- ❌ НЕ должны содержать: токены, пароли, sensitive data

### Просмотр логов:

```bash
# Последние строки access log
amvera exec sticker-art-e13nst -- tail -100 /var/log/nginx/access.log

# Последние строки error log
amvera exec sticker-art-e13nst -- tail -100 /var/log/nginx/error.log
```

**Примечание**: Логи **не сохраняются** при рестарте контейнера (ephemeral storage).

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
- [ ] Проверить логи сборки: `amvera logs build sticker-art-e13nst`
- [ ] Проверить runtime логи: `amvera logs run sticker-art-e13nst`
- [ ] Проверить что nginx стартовал без ошибок
- [ ] Проверить кэш работает: `curl -I https://sticker-art-e13nst.amvera.io/api/stickersets | grep X-Cache-Status`
- [ ] Открыть сайт: https://sticker-art-e13nst.amvera.io/miniapp/
- [ ] Проверить что стикеры загружаются
- [ ] Запустить E2E тесты: `npm run test:prod`

