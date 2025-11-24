<!-- fb7b86d9-a55c-4aae-9001-00255557a7f6 67ccef94-9c3a-44af-8ab4-adbb434272a3 -->
# План интеграции безопасного Viewport кода

## Цель

Интегрировать безопасный код для настройки viewport в Telegram Mini App, который:

- Разворачивает Mini App в full size (expand)
- Переводит в fullscreen на мобильных устройствах
- Использует проверки .isAvailable() и try/catch
- Работает с официальным SDK или адаптируется под текущий

## Текущая ситуация

- Приложение использует `@twa-dev/sdk` (неофициальный SDK)
- Инициализация происходит в `useTelegram.ts` (строка 216-217: `telegram.ready()`, `telegram.expand()`)
- Есть mock-режим для разработки
- В зависимостях есть `@telegram-apps/telegram-ui`, но нет `@telegram-apps/sdk` и `@telegram-apps/bridge`

## Решения

### Вариант 1: Гибридный подход (рекомендуется)

1. **Установить зависимости** (опционально, для будущей миграции):

- `@telegram-apps/sdk`
- `@telegram-apps/bridge`

2. **Создать модуль `setupTelegramViewportSafe`**:

- Файл: `miniapp/src/utils/setupTelegramViewport.ts`
- Поддержка обоих SDK (официальный и @twa-dev/sdk)
- Определение мобильных устройств
- Безопасные проверки и обработка ошибок

3. **Интегрировать в инициализацию**:

- Вызвать в `useTelegram.ts` после инициализации
- Или вызвать в `main.tsx` / `App.tsx` при загрузке приложения

### Вариант 2: Адаптация под текущий SDK

- Адаптировать код под `@twa-dev/sdk` API
- Использовать существующие методы `telegram.expand()`
- Добавить проверки доступности методов

## Реализация

### 1. Создать утилиту setupTelegramViewport.ts

- Функция `isMobile()` для определения мобильных устройств
- Функция `setupTelegramViewportSafe()` с поддержкой обоих SDK
- Проверка доступности методов через try/catch и проверки существования

### 2. Интегрировать в useTelegram.ts

- Вызвать `setupTelegramViewportSafe()` после `telegram.ready()` и `telegram.expand()`
- Сохранить существующую логику для обратной совместимости

### 3. Обновить package.json (опционально)

- Добавить `@telegram-apps/sdk` и `@telegram-apps/bridge` в dependencies
- Или создать адаптер для текущего SDK

## Файлы для изменения

- `miniapp/src/utils/setupTelegramViewport.ts` - новый файл с безопасной настройкой viewport
- `miniapp/src/hooks/useTelegram.ts` - интеграция вызова setupTelegramViewportSafe
- `package.json` - добавить зависимости (опционально)

## Подход

- Минималистичные изменения
- Сохранить обратную совместимость с текущим SDK
- Поддержка обоих SDK (официальный и @twa-dev/sdk)
- Безопасная обработка ошибок
- Работа в mock-режиме

### To-dos

- [ ] Исправить получение safe-area-inset-top: заменить getPropertyValue на правильный способ через временный элемент
- [ ] Добавить опциональную поддержку CSS переменных --tg-viewport-* с fallback на 100vh
- [ ] Оптимизировать функцию updateHeaderHeight для более точного вычисления высоты хедера