# Быстрый деплой исправления

## Что исправлено

✅ Добавлен вывод переменных окружения в логи для отладки
✅ Переменные `BACKEND_URL` и `STICKER_PROCESSOR_ORIGIN` определены в `Dockerfile` через `ENV`
✅ В логах теперь видны используемые значения

## Команды для деплоя

```bash
# 1. Проверить изменения
git status

# 2. Закоммитить
git add docker-entrypoint.sh SETUP.md DEPLOY.md README.md NGINX_STARTUP_FIX.md QUICK_FIX_DEPLOY.md
git commit -m "fix: add default values for nginx environment variables to prevent startup failure"

# 3. Запушить
git push
```

## Что произойдёт

1. Amvera получит webhook от GitHub
2. Автоматически запустится сборка
3. Nginx запустится с новыми значениями по умолчанию
4. Приложение заработает

## Проверка после деплоя

Открыть логи Amvera и убедиться, что видны строки:

```
=== STARTING NGINX ===
Using BACKEND_URL: https://stickerartgallery-e13nst.amvera.io
Using STICKER_PROCESSOR_ORIGIN: https://sticker-processor-e13nst.amvera.io
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

## Если всё равно не работает

1. Проверить, что переменные правильно экспортировались
2. Проверить, что `envsubst` работает корректно
3. Посмотреть полные логи nginx: `cat /etc/nginx/conf.d/default.conf`

## Откатиться назад (если нужно)

```bash
git revert HEAD
git push
```

