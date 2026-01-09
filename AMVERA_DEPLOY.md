# Деплой на Amvera

## Быстрый деплой

Для деплоя проекта на Amvera используйте скрипт:

```bash
./scripts/deploy-amvera.sh
```

Скрипт запросит у вас логин и пароль от учетной записи Amvera.

## Настройка репозиториев

У вас настроены два remote репозитория:

- **origin** (GitHub) - основной репозиторий: `git@github.com:E13nst/StickerArtWeb.git`
- **amvera** (Amvera) - для деплоя: `https://git.msk0.amvera.ru/e13nst/sticker-art`

## Рабочий процесс

### 1. Обычная работа с GitHub (по умолчанию)

```bash
git add .
git commit -m "Ваше описание изменений"
git push  # автоматически пушит в origin (GitHub)
```

### 2. Деплой на Amvera

После того как вы закоммитили изменения, запустите:

```bash
./scripts/deploy-amvera.sh
```

Или вручную:

```bash
git push --force amvera main:master
```

**Важно:** Скрипт делает force push, что перезаписывает историю в Amvera репозитории.

### 3. Проверка статуса

Проверьте статус сборки на [панели Amvera](https://amvera.ru).

## Полезные команды

Просмотр всех remote репозиториев:
```bash
git remote -v
```

Проверка текущей ветки:
```bash
git branch --show-current
```

## Устранение неполадок

Если возникли проблемы с аутентификацией:

1. Убедитесь, что вы используете правильный логин и пароль от Amvera
2. Проверьте настройки репозитория на [панели Amvera](https://amvera.ru)
3. Если нужно, удалите и добавьте remote заново:
   ```bash
   git remote remove amvera
   git remote add amvera https://git.msk0.amvera.ru/e13nst/sticker-art
   ```

## Структура веток

- **Локально:** ветка `main`
- **GitHub:** ветка `main`
- **Amvera:** ветка `master` (автоматически маппится из `main`)
