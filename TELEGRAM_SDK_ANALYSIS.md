# Детальный анализ использования Telegram SDK и Fullscreen API

## 4. Какой API/SDK используется для работы с Telegram?

### ✅ Ответ: **@twa-dev/sdk** (версия 8.0.2)

**Детали:**

1. **Основной SDK**: `@twa-dev/sdk` версия `^8.0.2`
   - Файл: `miniapp/src/hooks/useTelegram.ts:3`
   - Импорт: `import WebApp from '@twa-dev/sdk';`
   - Использование: `telegram = WebApp as unknown as TelegramWebApp;`

2. **Дополнительные зависимости:**
   - `@telegram-apps/telegram-ui` версия `^2.1.13` - только для UI компонентов
   - **НЕ используется**: `@telegram-apps/sdk` или `@telegram-apps/bridge`
   - **НЕ используется**: `@tma.js/*`

3. **Fallback механизм:**
   ```typescript
   // miniapp/src/hooks/useTelegram.ts:196-209
   if (isDev && (!hasTelegramWebApp || !hasInitData)) {
     // Fallback на mock в dev режиме
     telegram = createMockTelegramEnv(realInitDataForTesting);
   } else if (hasTelegramWebApp) {
     // Используем @twa-dev/sdk (production или real Telegram)
     telegram = WebApp as unknown as TelegramWebApp;
   } else {
     // Fallback на mock в production без Telegram WebApp
     telegram = createMockTelegramEnv(realInitDataForTesting);
   }
   ```

4. **Прямой доступ к window.Telegram:**
   - Используется для проверки доступности: `window.Telegram?.WebApp`
   - Используется для специфичных методов: `window.Telegram.WebApp.disableVerticalSwipes()`
   - Используется в `setupTelegramViewportSafe()`: `window.Telegram.WebApp`

**Вывод:** Используется **только @twa-dev/sdk**, с fallback на mock-режим. Нет миграции на официальный SDK.

---

## 5. В каком месте кода вызывается requestFullscreen (или его обёртка из SDK)?

### ❌ Ответ: **requestFullscreen НЕ вызывается**

**Важно:** В коде **НЕТ вызовов requestFullscreen()**. Вместо этого используется только `expand()`.

**Места вызова expand():**

1. **Центральный вызов при инициализации:**
   - Файл: `miniapp/src/utils/setupTelegramViewport.ts:68`
   - Контекст: `setupTelegramViewportSafe()` - асинхронная функция
   - Условие: `if (!wasExpanded)`
   - Задержка: `await new Promise(resolve => setTimeout(resolve, 100))` перед вызовом

2. **Повторная попытка на мобильных:**
   - Файл: `miniapp/src/utils/setupTelegramViewport.ts:74-79`
   - Условие: `if (isMobile() && !webApp.isExpanded)`
   - Задержка: `setTimeout(..., 300)`

3. **Обработчик события viewportChanged:**
   - Файл: `miniapp/src/utils/setupTelegramViewport.ts:96-98`
   - Условие: `if (!webApp.isExpanded && isMobile())`
   - Задержка: `setTimeout(..., 50)`

4. **Дополнительный обработчик в useTelegram:**
   - Файл: `miniapp/src/hooks/useTelegram.ts:241-247`
   - Событие: `viewportChanged`
   - Условие: `if (!telegram.isExpanded)`

5. **Обработчик скролла (fallback):**
   - Файл: `miniapp/src/hooks/useTelegram.ts:258-262`
   - Условие: `if (telegram && !telegram.isExpanded)`
   - Задержка: `setTimeout(..., 100)`

6. **В headerColor.ts:**
   - Файл: `miniapp/src/telegram/headerColor.ts:58-60`
   - Контекст: `applyTelegramHeaderColor()`
   - Без проверки состояния

**Условия, которые могут блокировать вызов:**

- `if (!inTma)` - не в Telegram Mini App → ранний return
- `if (!wasExpanded)` - уже развернуто → пропуск
- `if (isMobile())` - только на мобильных для повторной попытки
- `if (typeof webApp.expand === "function")` - проверка доступности метода

**Вывод:** Используется только `expand()`, `requestFullscreen()` отсутствует в коде.

---

## 6. Каков точный порядок инициализации viewport?

### Порядок инициализации:

1. **useTelegram.ts:217** - `telegram.ready()` - синхронный вызов
2. **useTelegram.ts:222** - `setupTelegramViewportSafe()` - асинхронный вызов (без await)
3. **setupTelegramViewportSafe.ts:47** - `await isTMA()` - проверка окружения
4. **setupTelegramViewportSafe.ts:48** - `if (!inTma) return` - ранний выход
5. **setupTelegramViewportSafe.ts:59** - `await new Promise(resolve => setTimeout(resolve, 100))` - задержка
6. **setupTelegramViewportSafe.ts:65** - `const wasExpanded = webApp.isExpanded` - проверка состояния
7. **setupTelegramViewportSafe.ts:68** - `webApp.expand()` - первый вызов expand()
8. **setupTelegramViewportSafe.ts:74-79** - повторная попытка на мобильных (через 300ms)
9. **setupTelegramViewportSafe.ts:90-102** - подписка на `viewportChanged`

**Проблемы в порядке инициализации:**

❌ **НЕТ вызова `init()`** - нет явной инициализации SDK
❌ **НЕТ вызова `viewport.mount()`** - не используется официальный Viewport API
❌ **НЕТ await для setupTelegramViewportSafe()** - вызов не ждется:
   ```typescript
   // useTelegram.ts:222
   setupTelegramViewportSafe().catch((error) => {
     console.warn('[TMA] Ошибка при настройке viewport:', error);
   });
   // ⚠️ Нет await, выполнение продолжается сразу
   ```
❌ **НЕТ гарантии, что expand() вызывается после mount()** - mount() вообще не вызывается

**Вывод:** Порядок инициализации неполный, отсутствуют критические шаги (mount, await).

---

## 7. Проверяется ли доступность методов перед вызовом?

### ✅ Частично проверяется

**Проверки доступности:**

1. **Проверка функции expand:**
   ```typescript
   // setupTelegramViewportSafe.ts:62
   if (typeof webApp.expand === "function") {
     // вызов
   }
   ```

2. **Проверка функции onEvent:**
   ```typescript
   // setupTelegramViewportSafe.ts:90
   if (typeof webApp.onEvent === "function") {
     // подписка
   }
   ```

3. **Проверка disableVerticalSwipes:**
   ```typescript
   // useTelegram.ts:228
   if (typeof window !== 'undefined' && window.Telegram?.WebApp?.disableVerticalSwipes) {
     // вызов
   }
   ```

**❌ Что НЕ проверяется:**

- ❌ **НЕТ проверки `isAvailable()`** - не используется метод `viewport.expand.isAvailable()` или аналогичный
- ❌ **НЕТ логирования доступности** - не логируется результат проверок `isAvailable()`
- ❌ **НЕТ проверки версии SDK** - не проверяется, поддерживает ли версия нужные методы

**Вывод:** Проверяется только наличие функции через `typeof`, но не используется официальный API проверки доступности.

---

## 8. Есть ли в коде дополнительные ограничения, влияющие на fullscreen?

### ✅ Да, есть несколько ограничений

1. **Определение мобильного устройства:**
   ```typescript
   // setupTelegramViewportSafe.ts:12-17
   export function isMobile(): boolean {
     if (typeof navigator === "undefined") return false;
     return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
       navigator.userAgent
     );
   }
   ```
   - Используется только для повторной попытки expand()
   - Не блокирует основной вызов expand()

2. **Ранний return до expand():**
   ```typescript
   // setupTelegramViewportSafe.ts:48-51
   if (!inTma) {
     console.log("[TMA Viewport] Не в Telegram Mini App, пропускаем настройку viewport");
     return; // ⚠️ Ранний выход
   }
   ```

3. **Проверка состояния перед expand():**
   ```typescript
   // setupTelegramViewportSafe.ts:65-83
   const wasExpanded = webApp.isExpanded;
   if (!wasExpanded) {
     webApp.expand();
   } else {
     console.log("[TMA Viewport] Mini App уже развернута, пропускаем expand()");
     // ⚠️ Если уже развернуто, expand() не вызывается
   }
   ```

4. **Нет блокировки по окружению:**
   - ✅ Работает и в dev, и в production
   - ✅ Нет проверок типа `if (import.meta.env.PROD)`

**Вывод:** Основное ограничение - ранний return при отсутствии Telegram WebApp и пропуск expand() если уже развернуто.

---

## 9. Фиксируются ли ошибки и исключения при вызове fullscreen?

### ✅ Частично фиксируются

**Обработка ошибок:**

1. **В setupTelegramViewportSafe:**
   ```typescript
   // setupTelegramViewportSafe.ts:62-86
   try {
     const wasExpanded = webApp.isExpanded;
     if (!wasExpanded) {
       webApp.expand();
       console.log("[TMA Viewport] Mini App развернута в full size (@twa-dev/sdk)");
     }
   } catch (e) {
     console.warn("[TMA Viewport] Ошибка expand (@twa-dev/sdk):", e);
   }
   ```

2. **Внешний try-catch:**
   ```typescript
   // setupTelegramViewportSafe.ts:44-106
   export async function setupTelegramViewportSafe(): Promise<void> {
     try {
       // весь код
     } catch (e) {
       console.error("[TMA Viewport] Критическая ошибка setupTelegramViewportSafe:", e);
     }
   }
   ```

3. **В useTelegram:**
   ```typescript
   // useTelegram.ts:222-224
   setupTelegramViewportSafe().catch((error) => {
     console.warn('[TMA] Ошибка при настройке viewport:', error);
   });
   ```

**❌ Что НЕ обрабатывается:**

- ❌ **НЕТ обработки специфичных ошибок Telegram** - не проверяются коды ошибок типа `UNSUPPORTED`, `ALREADY_FULLSCREEN`
- ❌ **НЕТ подписки на события ошибок** - не обрабатываются события типа `fullscreen_failed`
- ❌ **НЕТ детального логирования** - не логируется тип ошибки, код ошибки, контекст

**Вывод:** Базовая обработка ошибок есть, но нет специфичной обработки ошибок Telegram API.

---

## 10. Подписывается ли приложение на события, связанные с fullscreen?

### ⚠️ Частично подписывается

**Обрабатываемые события:**

1. **viewportChanged:**
   ```typescript
   // setupTelegramViewportSafe.ts:90-102
   webApp.onEvent("viewportChanged", () => {
     if (!webApp.isExpanded && isMobile()) {
       console.log("[TMA Viewport] Viewport изменился, разворачиваем обратно");
       setTimeout(() => {
         if (typeof webApp.expand === "function") {
           webApp.expand();
         }
       }, 50);
     }
   });
   ```

2. **viewportChanged (дубликат в useTelegram):**
   ```typescript
   // useTelegram.ts:241-247
   telegram.onEvent('viewportChanged', () => {
     if (!telegram.isExpanded) {
       console.log('📱 Viewport изменился, расширяем миниапп обратно');
       telegram.expand();
     }
   });
   ```

**❌ Что НЕ обрабатывается:**

- ❌ **НЕТ события `fullscreen_changed`** - не подписывается на изменения fullscreen состояния
- ❌ **НЕТ события `fullscreen_failed`** - не обрабатываются ошибки fullscreen
- ❌ **НЕТ логирования payload событий** - не логируется содержимое событий для отладки
- ❌ **НЕТ обработки других viewport событий** - например, `viewportStableHeightChanged`

**Вывод:** Подписывается только на `viewportChanged`, но не на специфичные fullscreen события.

---

## 📊 Итоговая сводка проблем

### Критические проблемы:

1. ❌ **НЕТ использования requestFullscreen()** - используется только expand(), который может не давать полноценный fullscreen
2. ❌ **НЕТ вызова viewport.mount()** - не используется официальный Viewport API
3. ❌ **НЕТ await для setupTelegramViewportSafe()** - инициализация не ждется
4. ❌ **НЕТ проверки isAvailable()** - не проверяется доступность методов через официальный API
5. ❌ **НЕТ обработки fullscreen событий** - не подписывается на fullscreen_changed/fullscreen_failed

### Рекомендации:

1. Добавить использование официального Viewport API из @telegram-apps/sdk
2. Добавить вызов `viewport.mount()` перед `expand()`
3. Добавить проверку `viewport.expand.isAvailable()` перед вызовом
4. Добавить подписку на события `fullscreen_changed` и `fullscreen_failed`
5. Добавить await для `setupTelegramViewportSafe()` в useTelegram
6. Добавить детальное логирование доступности методов и ошибок

