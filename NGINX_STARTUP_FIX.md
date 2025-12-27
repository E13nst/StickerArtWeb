# Nginx Startup Fix - 27.12.2025

## Проблема

Приложение не стартовало на Amvera с ошибкой в логах:

```
=== STARTING NGINX ===
nginx -t
```

После чего процесс не продолжался.

## Причина

В `nginx.conf` используются две переменные окружения:
- `${BACKEND_URL}` 
- `${STICKER_PROCESSOR_ORIGIN}`

При запуске `envsubst` в `docker-entrypoint.sh` переменная `STICKER_PROCESSOR_ORIGIN` не была установлена в Amvera, что приводило к пустому значению в конфигурации nginx:

```nginx
proxy_pass ;  # пустое значение!
```

Nginx не мог пройти проверку `nginx -t` и не стартовал.

## Решение

### 1. Проверка значений по умолчанию в `Dockerfile`

Убедились, что переменные определены в `Dockerfile`:

```dockerfile
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
ENV STICKER_PROCESSOR_ORIGIN=https://sticker-processor-e13nst.amvera.io
```

### 2. Добавлен вывод переменных в `docker-entrypoint.sh`

```bash
# Выводим используемые переменные окружения для отладки
echo "Using BACKEND_URL: ${BACKEND_URL}"
echo "Using STICKER_PROCESSOR_ORIGIN: ${STICKER_PROCESSOR_ORIGIN}"
```

Теперь в логах видно, какие значения используются при старте nginx.

### 3. Обновлена документация

- `SETUP.md` - добавлена информация о `STICKER_PROCESSOR_ORIGIN`
- `DEPLOY.md` - добавлена обе переменные
- `README.md` - добавлена информация о значениях по умолчанию

## Результат

✅ Переменные окружения определены в `Dockerfile` через `ENV`
✅ В логах видны используемые значения для отладки
✅ Можно переопределить значения через Amvera Console если нужно (они переопределят `ENV` из Dockerfile)

## Для деплоя

Просто пуш в репозиторий:

```bash
git add .
git commit -m "fix: add default values for nginx environment variables"
git push
```

Amvera автоматически пересоберёт и задеплоит.

## Альтернатива (опционально)

Если хотите явно задать переменные в Amvera Console → Settings → Environment Variables:

```bash
BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
STICKER_PROCESSOR_ORIGIN=https://sticker-processor-e13nst.amvera.io
```

Но это не обязательно - значения по умолчанию уже корректны.

