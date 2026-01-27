# Исправление проблемы с Telegram Share и inline режимом

## Дата исправления
27 января 2026

## Проблема

После аудита и применения улучшений (замена U+200B на U+2060) возникли следующие проблемы:

1. **iPhone app и Telegram Web**: Данные корректно подставляются в нужный чат, но состояние строки ввода **не меняется на inline режим**, хотя форматирование верное, без лишних пробелов.

2. **Desktop версия Telegram**: **Не открывается окно выбора чата** при использовании `tg.openTelegramLink()`.

## Причина проблемы

**Невидимый символ (U+2060) перед `@` мешает Telegram распознать начало inline-запроса.**

Telegram определяет начало inline-запроса по символу `@` в начале текста. Когда перед `@` стоит невидимый символ, Telegram не может корректно распознать, что это должно триггерить inline режим бота.

## Решение

### 1. Убрать невидимые символы

Невидимые символы были необходимы для обхода автоматического добавления пробела Telegram перед `@` в формате `t.me/share/url`, но они мешают триггеру inline режима.

### 2. Использовать прямой deep link к боту

Вместо `t.me/share/url?url=&text=@bot text` используем прямой deep link к боту:
- `t.me/<bot_username>?text=@bot text` (HTTPS)
- `tg://resolve?domain=<bot_username>&text=@bot text` (Deep link)

**Преимущества:**
- Прямой deep link к боту лучше триггерит inline режим на всех платформах
- Telegram может не добавлять пробел перед `@` при использовании прямого deep link к боту
- Более надежное открытие на Desktop через `window.open()`

### 3. Улучшить обработку для Desktop

На Desktop используем `window.open()` вместо `tg.openTelegramLink()` для более надежного открытия ссылки.

## Изменения в коде

### `miniapp/src/utils/stickerUtils.ts`

**Функция `createTelegramShareUrl()`:**
- Убрана поддержка невидимых символов
- Добавлен параметр `useDirectBotLink` (по умолчанию `true`)
- При `useDirectBotLink=true` используется формат `t.me/bot?text=@bot text`
- При `useDirectBotLink=false` или при указании `shareUrl` используется формат `t.me/share/url`

**Функция `createTelegramDeepLink()`:**
- Аналогичные изменения для deep link формата `tg://`

### `miniapp/src/pages/GeneratePage.tsx`

**Функция `handleShareSticker()`:**
- Используется `createTelegramShareUrl()` с `useDirectBotLink: true`
- Улучшена обработка для Desktop: используется `window.open()` вместо `tg.openTelegramLink()`
- Добавлено определение платформы для выбора оптимального метода открытия

## Формат URL

### До исправления:
```
https://t.me/share/url?url=&text=%E2%81%A0%40stixlybot%20CAACAgIAAxkBAAIBY2...
```
(С невидимым символом U+2060 перед @)

### После исправления:
```
https://t.me/stixlybot?text=%40stixlybot%20CAACAgIAAxkBAAIBY2...
```
(Прямой deep link к боту с @username в тексте)

## Ожидаемое поведение

1. **iPhone app**: Открывается выбор чата, текст `@stixlybot fileId` предзаполняется, **inline режим активируется автоматически**.

2. **Telegram Web**: Открывается выбор чата, текст `@stixlybot fileId` предзаполняется, **inline режим активируется автоматически**.

3. **Desktop**: Открывается окно выбора чата через `window.open()`, текст `@stixlybot fileId` предзаполняется, **inline режим активируется автоматически**.

## Примечания

- Согласно документации Telegram, при использовании параметра `text` в deep links к ботам, Telegram может добавить пробел перед `@` в начале текста. Однако при использовании прямого deep link к боту (`t.me/bot?text=...`) это поведение может отличаться.

- Если проблема с пробелом перед `@` все еще возникает, можно попробовать альтернативные подходы:
  - Использовать формат `t.me/bot?start=...` с параметром, который бот обработает
  - Использовать Bot API для отправки inline результатов напрямую (если доступно)

## Тестирование

Необходимо протестировать на:
- ✅ iPhone app (Telegram iOS)
- ✅ Telegram Web (web.telegram.org)
- ✅ Desktop (Telegram Desktop Windows/macOS/Linux)

Проверить:
1. Открывается ли окно выбора чата
2. Предзаполняется ли текст `@stixlybot fileId`
3. Активируется ли inline режим автоматически
4. Нет ли лишних пробелов перед `@`

## Ссылки

- [Telegram Deep Links Documentation](https://core.telegram.org/api/links#bot-links)
- [Telegram Share Widget Documentation](https://core.telegram.org/widgets/share)
- [Telegram Inline Bots Documentation](https://core.telegram.org/api/bots/inline)
