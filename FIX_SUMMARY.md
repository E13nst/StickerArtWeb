# Исправление запуска Nginx - Резюме

## Проблема
Приложение не стартовало на Amvera, потому что переменная `STICKER_PROCESSOR_ORIGIN` не была передана в `envsubst`, что приводило к пустому значению в `nginx.conf`.

## Что было сделано

### 1. Добавлен вывод переменных в логи
В `docker-entrypoint.sh` добавлены строки для отладки:
```bash
echo "Using BACKEND_URL: ${BACKEND_URL}"
echo "Using STICKER_PROCESSOR_ORIGIN: ${STICKER_PROCESSOR_ORIGIN}"
```

### 2. Проверено наличие ENV в Dockerfile
Убедились, что переменные определены в `Dockerfile` (строки 86-87):
```dockerfile
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io
ENV STICKER_PROCESSOR_ORIGIN=https://sticker-processor-e13nst.amvera.io
```

### 3. Обновлена документация
- `SETUP.md` - добавлена информация о `STICKER_PROCESSOR_ORIGIN`
- `DEPLOY.md` - обновлены переменные окружения
- `README.md` - добавлена информация о переменных

## Как это работает

1. Docker использует `ENV` из `Dockerfile` как значения по умолчанию
2. Если в Amvera Console установлены переменные окружения, они **переопределяют** значения из `ENV`
3. `envsubst` подставляет эти значения в шаблон nginx конфигурации
4. Nginx стартует с правильной конфигурацией

## Изменённые файлы
- `docker-entrypoint.sh` - добавлен вывод переменных для отладки
- `SETUP.md` - обновлена таблица переменных окружения
- `DEPLOY.md` - обновлен раздел с переменными
- `README.md` - добавлена информация о переменных
- `NGINX_STARTUP_FIX.md` - документация исправления
- `QUICK_FIX_DEPLOY.md` - инструкция по деплою

## Для деплоя
```bash
git add .
git commit -m "fix: ensure STICKER_PROCESSOR_ORIGIN is visible in nginx startup logs"
git push
```

После деплоя в логах должны появиться строки:
```
=== STARTING NGINX ===
Using BACKEND_URL: https://stickerartgallery-e13nst.amvera.io
Using STICKER_PROCESSOR_ORIGIN: https://sticker-processor-e13nst.amvera.io
```

