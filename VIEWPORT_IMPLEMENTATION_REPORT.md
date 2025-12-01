# Отчет по реализации Viewport в приложении

## 📋 Обзор

Приложение использует **неофициальный SDK** (`@twa-dev/sdk`) вместо официального `@telegram-apps/sdk` или `@tma.js/sdk`. Официальный Viewport компонент из SDK **не используется**.

**Ссылка на документацию**: [Telegram Mini Apps Viewport](https://docs.telegram-mini-apps.com/packages/telegram-apps-sdk/2-x/components/viewport)

---

## 🔍 Текущая реализация

### 1. Используемый SDK

- **Пакет**: `@twa-dev/sdk` версия `^8.0.2`
- **Файл**: `miniapp/src/hooks/useTelegram.ts`
- **Инициализация**: Используется `WebApp` из `@twa-dev/sdk`

```typescript
import WebApp from '@twa-dev/sdk';
telegram = WebApp as unknown as TelegramWebApp;
```

### 2. Viewport данные

В mock-режиме используются статические значения:
```typescript
viewportHeight: 600,
viewportStableHeight: 600,
```

### 3. Обработка событий Viewport

Есть обработчик события `viewportChanged`:
```typescript
telegram.onEvent('viewportChanged', () => {
  if (!telegram.isExpanded) {
    console.log('📱 Viewport изменился, расширяем миниапп обратно');
    telegram.expand();
  }
});
```

### 4. Meta теги

В HTML файлах используется:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

✅ `viewport-fit=cover` - правильно настроен для iOS

---

## ❌ Что отсутствует (согласно документации)

### 1. Официальный Viewport компонент

**Не используется**:
- `viewport.mount()` - монтирование компонента
- `viewport.bindCssVars()` - привязка CSS переменных
- `viewport.expand()` - расширение viewport
- `viewport.requestFullscreen()` - полноэкранный режим

### 2. CSS переменные Viewport

**Не используются** официальные CSS переменные:
- `--tg-viewport-height`
- `--tg-viewport-width`
- `--tg-viewport-stable-height`

Вместо этого используется класс `tg-viewport-stable` в `index.css`:
```css
body.tg-viewport-stable {
  overflow-y: auto;
}
```

### 3. Safe Area Insets

**Частично используется** через CSS `env()`:
- ✅ `env(safe-area-inset-top)` - используется в нескольких местах
- ✅ `env(safe-area-inset-bottom)` - используется в некоторых компонентах
- ❌ Нет использования через SDK: `viewport.safeAreaInsets()`
- ❌ Нет использования через SDK: `viewport.contentSafeAreaInsets()`

---

## 📄 Анализ по страницам

### 1. **GalleryPage** (`/gallery`)
- **Viewport**: Использует `useViewportVisibility` хук для определения видимости элементов
- **Safe Area**: Использует `env(safe-area-inset-top)` в `GalleryControlsBar`
- **Проблемы**: Нет использования официального Viewport API

### 2. **ProfilePage** (`/profile/:userId`)
- **Viewport**: Использует стандартные CSS единицы (`100vw`, `100vh`)
- **Safe Area**: Использует `env(safe-area-inset-top)` в `StixlyTopHeader`
- **Проблемы**: Нет использования официального Viewport API

### 3. **MyProfilePage** (`/profile`)
- **Viewport**: Использует стандартные CSS единицы
- **Safe Area**: Использует `env(safe-area-inset-top)` через `StixlyTopHeader`
- **Проблемы**: Нет использования официального Viewport API

### 4. **DashboardPage** (`/dashboard`)
- **Viewport**: Использует `calc(100vh * 0.146)` для высоты хедера
- **Safe Area**: Использует `env(safe-area-inset-top)` в `StixlyTopHeader`
- **Проблемы**: Нет использования официального Viewport API

### 5. **AuthorPage** (`/author/:authorId`)
- **Viewport**: Использует стандартные CSS единицы
- **Safe Area**: Использует `env(safe-area-inset-top)` через `StixlyTopHeader`
- **Проблемы**: Нет использования официального Viewport API

### 6. **NftSoonPage** (`/nft-soon`)
- **Viewport**: Использует стандартные CSS единицы
- **Safe Area**: Использует `env(safe-area-inset-top)` через общие стили
- **Проблемы**: Нет использования официального Viewport API

---

## 🎯 Компоненты, использующие Viewport

### 1. **StixlyTopHeader**
- **Файл**: `miniapp/src/components/StixlyTopHeader.tsx`
- **Использование**:
  - `calc(100vh * 0.146)` - высота хедера
  - `calc(100vw * 0.038)` - радиусы скругления
  - `env(safe-area-inset-top)` - отступ для iOS
  - Вычисление `--stixly-header-height` с учетом safe area

### 2. **PackCard**
- **Файл**: `miniapp/src/components/PackCard.tsx`
- **Использование**: `useViewportVisibility` хук для определения видимости в viewport
- **Приоритеты загрузки**: `TIER_1_VIEWPORT`, `TIER_2_NEAR_VIEWPORT`

### 3. **BottomNav**
- **Файл**: `miniapp/src/components/BottomNav.tsx`
- **Использование**: `calc(100vh * 0.062)` - высота навигации

### 4. **GalleryControlsBar**
- **Файл**: `miniapp/src/components/GalleryControlsBar.tsx`
- **Использование**: `env(safe-area-inset-top)` для позиционирования

### 5. **CompactControlsBar**
- **Файл**: `miniapp/src/components/CompactControlsBar.tsx`
- **Использование**: `env(safe-area-inset-top)` для позиционирования

---

## ⚠️ Проблемы и рекомендации

### Критические проблемы

1. **Нет использования официального SDK**
   - Используется `@twa-dev/sdk` вместо `@telegram-apps/sdk` или `@tma.js/sdk`
   - Нет доступа к официальному Viewport API

2. **Нет привязки CSS переменных**
   - Не используются `--tg-viewport-*` переменные
   - Нет автоматического обновления размеров viewport

3. **Статические значения в mock-режиме**
   - `viewportHeight: 600` и `viewportStableHeight: 600` - жестко заданы
   - Не отражают реальные размеры устройства

### Рекомендации

1. **Миграция на официальный SDK**
   ```typescript
   // Вместо @twa-dev/sdk использовать:
   import { viewport } from '@telegram-apps/sdk';
   // или
   import { viewport } from '@tma.js/sdk';
   ```

2. **Инициализация Viewport**
   ```typescript
   if (viewport.mount.isAvailable()) {
     viewport.mount();
   }
   ```

3. **Привязка CSS переменных**
   ```typescript
   if (viewport.bindCssVars.isAvailable()) {
     viewport.bindCssVars();
     // Создаст: --tg-viewport-height, --tg-viewport-width, --tg-viewport-stable-height
   }
   ```

4. **Использование Safe Area Insets через SDK**
   ```typescript
   const safeAreaTop = viewport.safeAreaInsetTop();
   const safeAreaBottom = viewport.safeAreaInsetBottom();
   ```

5. **Расширение Viewport**
   ```typescript
   if (viewport.expand.isAvailable()) {
     viewport.expand();
   }
   ```

---

## 📊 Сравнение с документацией

| Функция | Документация | Текущая реализация | Статус |
|---------|-------------|-------------------|--------|
| Mount Viewport | ✅ `viewport.mount()` | ❌ Не используется | ❌ Отсутствует |
| CSS Variables | ✅ `viewport.bindCssVars()` | ❌ Не используется | ❌ Отсутствует |
| Expand Viewport | ✅ `viewport.expand()` | ⚠️ `telegram.expand()` | ⚠️ Частично |
| Fullscreen | ✅ `viewport.requestFullscreen()` | ❌ Не используется | ❌ Отсутствует |
| Safe Area Insets | ✅ `viewport.safeAreaInsets()` | ⚠️ `env(safe-area-inset-*)` | ⚠️ Частично |
| Viewport Events | ✅ `viewportChanged` | ✅ `onEvent('viewportChanged')` | ✅ Реализовано |
| Meta viewport-fit | ✅ `viewport-fit=cover` | ✅ Настроен | ✅ Реализовано |

---

## 🔧 Файлы, требующие изменений

1. **package.json**
   - Добавить `@telegram-apps/sdk` или `@tma.js/sdk`

2. **miniapp/src/hooks/useTelegram.ts**
   - Мигрировать на официальный SDK
   - Добавить инициализацию Viewport
   - Добавить привязку CSS переменных

3. **miniapp/src/index.css**
   - Использовать `--tg-viewport-*` переменные вместо статических значений

4. **miniapp/src/components/StixlyTopHeader.tsx**
   - Использовать `viewport.safeAreaInsetTop()` вместо `env(safe-area-inset-top)`

5. **Все страницы**
   - Использовать CSS переменные `--tg-viewport-height` и `--tg-viewport-width`

---

## 📝 Выводы

1. **Текущая реализация работает**, но использует неофициальный SDK и обходные пути
2. **Safe Area Insets** частично реализованы через CSS `env()`, но не через SDK
3. **Viewport события** обрабатываются, но нет полной интеграции с официальным API
4. **Рекомендуется миграция** на официальный SDK для лучшей совместимости и поддержки

---

**Дата отчета**: 2024
**Версия приложения**: Проверена на основе текущего кода
**Ссылка на документацию**: https://docs.telegram-mini-apps.com/packages/telegram-apps-sdk/2-x/components/viewport







