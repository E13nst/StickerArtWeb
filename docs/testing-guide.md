# Руководство по тестированию StickerArt Web

## Обзор стратегии тестирования

Проект использует многоуровневый подход к тестированию:

1. **Визуальное тестирование** - проверка соответствия дизайну из Figma
2. **E2E тестирование** - автоматизированные тесты с Playwright
3. **Ручное тестирование** - проверка пользовательских сценариев на разных устройствах

### Приоритеты тестирования

- ✅ **Критично**: Основные пользовательские потоки (просмотр галереи, лайки, авторизация)
- ✅ **Важно**: Визуальное соответствие дизайну, производительность
- ✅ **Желательно**: Edge cases, анимации, accessibility

---

## Визуальное тестирование

Визуальное тестирование гарантирует, что реализованные компоненты соответствуют дизайну из Figma pixel-perfect.

### Экспорт скриншотов из Figma

#### Способ 1: Через MCP (TalkToFigma)

Если у вас настроен MCP сервер `user-TalkToFigma`, можно использовать его для автоматического экспорта:

1. **Проверка доступных инструментов MCP:**
   ```bash
   # Инструменты доступны через call_mcp_tool
   # Проверьте доступные инструменты в папке:
   # C:\Users\Notebook\.cursor\projects\...\mcps\user-TalkToFigma\
   ```

2. **Экспорт компонента:**
   - Используйте `call_mcp_tool` с сервером `user-TalkToFigma`
   - Укажите Node ID из `docs/figma-mapping.md`
   - Экспортируйте в PNG/SVG с нужным разрешением

3. **Пример структуры:**
   ```
   tests/visual/
   ├── baseline/          # Базовые скриншоты из Figma
   │   ├── gallery-page.png
   │   ├── pack-card.png
   │   └── navbar.png
   └── actual/            # Скриншоты из браузера
       ├── gallery-page.png
       ├── pack-card.png
       └── navbar.png
   ```

#### Способ 2: Ручной экспорт из Figma

1. **Откройте Figma:**
   - Найдите нужный компонент/страницу
   - Используйте Node ID из `docs/figma-mapping.md` для быстрого поиска

2. **Экспорт:**
   - Выберите фрейм/компонент
   - Правый клик → "Export" или `Ctrl+Shift+E`
   - Формат: PNG (для pixel-perfect) или SVG (для векторных элементов)
   - Разрешение: 2x или 3x для ретина-дисплеев
   - Сохраните в `tests/visual/baseline/`

3. **Рекомендуемые настройки:**
   - **Формат**: PNG @2x
   - **Размер**: Соответствует viewport браузера (375px для мобильных, 1920px для десктопа)
   - **Фон**: Включен (если нужен)

### Скриншоты в браузере

#### Использование Playwright для скриншотов

Playwright может делать скриншоты элементов и страниц:

```typescript
// Скриншот всей страницы
await page.screenshot({ 
  path: 'tests/visual/actual/gallery-page.png',
  fullPage: true 
});

// Скриншот конкретного элемента
await page.locator('[data-testid="pack-card"]').first()
  .screenshot({ path: 'tests/visual/actual/pack-card.png' });

// Скриншот с кастомными размерами viewport
await page.setViewportSize({ width: 375, height: 812 }); // iPhone
await page.screenshot({ path: 'tests/visual/actual/gallery-mobile.png' });
```

#### Ручной скриншот через DevTools

1. **Откройте DevTools** (`F12`)
2. **Device Toolbar** (`Ctrl+Shift+M`)
3. **Выберите устройство** или задайте кастомный размер
4. **Скриншот:**
   - Chrome: `Ctrl+Shift+P` → "Capture screenshot"
   - Или используйте расширения (Full Page Screen Capture)

### Инструменты для сравнения

#### 1. Pixelmatch (рекомендуется)

**Установка:**
```bash
npm install --save-dev pixelmatch pngjs
```

**Использование:**
```typescript
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';

const img1 = PNG.sync.read(fs.readFileSync('baseline.png'));
const img2 = PNG.sync.read(fs.readFileSync('actual.png'));
const { width, height } = img1;
const diff = new PNG({ width, height });

const numDiffPixels = pixelmatch(
  img1.data, 
  img2.data, 
  diff.data, 
  width, 
  height,
  { threshold: 0.1 } // Чувствительность (0-1)
);

// Сохранить diff изображение
fs.writeFileSync('diff.png', PNG.sync.write(diff));

// Проверить порог различий (например, < 1%)
const diffPercentage = (numDiffPixels / (width * height)) * 100;
expect(diffPercentage).toBeLessThan(1);
```

#### 2. Playwright Visual Comparisons

Playwright имеет встроенную поддержку визуального сравнения:

```typescript
import { test, expect } from '@playwright/test';

test('gallery page visual', async ({ page }) => {
  await page.goto('/miniapp/gallery');
  await expect(page).toHaveScreenshot('gallery-page.png', {
    fullPage: true,
    threshold: 0.2, // Допустимое отличие (0-1)
    maxDiffPixels: 100, // Максимум отличающихся пикселей
  });
});
```

**Настройка в `playwright.config.ts`:**
```typescript
expect: {
  toHaveScreenshot: {
    threshold: 0.2,
    maxDiffPixels: 100,
  }
}
```

#### 3. BackstopJS

**Установка:**
```bash
npm install --save-dev backstopjs
npx backstopjs init
```

**Конфигурация `backstop.json`:**
```json
{
  "scenarios": [
    {
      "label": "Gallery Page",
      "url": "http://localhost:3000/miniapp/gallery",
      "viewports": [
        { "width": 375, "height": 812, "label": "Mobile" },
        { "width": 1920, "height": 1080, "label": "Desktop" }
      ]
    }
  ]
}
```

**Запуск:**
```bash
npx backstopjs test
npx backstopjs approve  # Принять изменения как baseline
```

#### 4. Percy / Chromatic (CI/CD)

Для автоматического визуального тестирования в CI/CD:

- **Percy**: Интеграция с Playwright
- **Chromatic**: Для Storybook компонентов

### Критерии визуального соответствия

- ✅ **Цвета**: Должны совпадать с Figma (допуск ±2% для антиалиасинга)
- ✅ **Отступы**: Точное соответствие (margin, padding)
- ✅ **Типографика**: Шрифт, размер, вес, line-height
- ✅ **Border radius**: Точное соответствие
- ✅ **Тени**: Соответствие blur, spread, opacity
- ✅ **Анимации**: Плавность, timing, easing (проверяется вручную)

**Допустимые отклонения:**
- Антиалиасинг: ±1px
- Округление пикселей: ±0.5px
- Цвета: ±2% для градиентов

---

## E2E тестирование

E2E тесты проверяют полные пользовательские сценарии от начала до конца.

### Структура тестов Playwright

Текущая структура тестов:

```
tests/
├── gallery.spec.ts              # Тесты галереи
├── stickerset-actions.spec.ts   # Тесты действий со стикерсетами
├── stickerset-search.spec.ts    # Тесты поиска
├── gallery-benchmark.spec.ts    # Бенчмарк производительности
├── nginx-cache.spec.ts          # Тесты кеширования
└── helpers/
    ├── index.ts                 # Централизованный экспорт
    ├── common/
    │   ├── auth-helpers.ts      # Помощники для авторизации
    │   ├── gallery-helpers.ts   # Помощники для галереи
    │   └── media-helpers.ts     # Помощники для медиа
    └── benchmark/
        └── benchmark-helpers.ts # Помощники для бенчмарков
```

### Конфигурация Playwright

**Основной конфиг:** `miniapp/playwright.config.ts`
- Локальное окружение (`http://localhost:3000`)
- Автозапуск dev server
- Chrome и Mobile (iPhone 13)

**Production конфиг:** `miniapp/playwright.config.prod.ts`
- Production окружение (`https://sticker-art-e13nst.amvera.io`)
- Без автозапуска сервера
- Увеличенные таймауты

### Запуск тестов

```bash
# Все E2E тесты (локально)
npm run test:e2e

# С UI интерфейсом
npm run test:e2e:ui

# В видимом браузере (headed mode)
npm run test:e2e:headed

# Режим отладки
npm run test:e2e:debug

# Конкретный тест
npm run test:actions

# Production тесты
npm run test:prod

# Бенчмарк тесты
npm run test:benchmark

# Просмотр отчета
npm run test:e2e:report
```

### Страницы для тестирования

#### 1. Dashboard Page (`/miniapp/dashboard`)

**Что тестировать:**
- Загрузка статистики
- Отображение метрик (карточки)
- Навигация на другие страницы
- Responsive поведение

**Пример теста:**
```typescript
test('dashboard loads statistics', async ({ page }) => {
  await page.goto('/miniapp/dashboard');
  await expect(page.locator('[data-testid="metric-card"]')).toHaveCount(4);
  await expect(page.locator('text=Total Stickers')).toBeVisible();
});
```

#### 2. Gallery Page (`/miniapp/gallery`)

**Что тестировать:**
- Загрузка стикерсетов (>10 карточек)
- Бесконечная прокрутка
- Фильтры (категории, даты, тип)
- Поиск
- Сортировка
- Открытие детального просмотра
- Лайки

**Существующие тесты:**
- ✅ `tests/gallery.spec.ts` - базовая загрузка
- ✅ `tests/stickerset-search.spec.ts` - поиск
- ✅ `tests/stickerset-actions.spec.ts` - действия

#### 3. Profile Page (`/miniapp/profile`)

**Что тестировать:**
- Загрузка профиля пользователя
- Отображение аватара, имени, статистики
- Список стикерсетов пользователя
- Навигация к автору

#### 4. My Profile Page (`/miniapp/profile` - свой профиль)

**Что тестировать:**
- Отображение своего профиля
- Редактирование профиля (если есть)
- Управление своими стикерсетами

#### 5. Author Page (`/miniapp/author/:id`)

**Что тестировать:**
- Загрузка информации об авторе
- Список стикерсетов автора
- Статистика автора

#### 6. Generate Page (`/miniapp/generate`)

**Что тестировать:**
- Форма генерации стикеров
- Валидация полей
- Отправка формы
- Обработка ошибок

#### 7. Swipe Page (`/miniapp/nft-soon`)

**Что тестировать:**
- Загрузка карточек для свайпа
- Свайп жесты (left/right)
- Анимации переходов
- Обработка конца стека

### Примеры тестов для новых компонентов

#### Тест нового UI компонента (Button)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Button Component', () => {
  test('renders with correct text', async ({ page }) => {
    await page.goto('/miniapp/design-system-demo');
    await expect(page.locator('[data-testid="button-primary"]')).toHaveText('Click me');
  });

  test('handles click events', async ({ page }) => {
    await page.goto('/miniapp/design-system-demo');
    await page.locator('[data-testid="button-primary"]').click();
    await expect(page.locator('.toast')).toContainText('Button clicked');
  });

  test('displays loading state', async ({ page }) => {
    await page.goto('/miniapp/design-system-demo');
    await page.locator('[data-testid="button-loading"]').click();
    await expect(page.locator('[data-testid="button-loading"]')).toBeDisabled();
  });
});
```

#### Тест модального окна (BottomSheet)

```typescript
test.describe('BottomSheet Component', () => {
  test('opens on trigger click', async ({ page }) => {
    await page.goto('/miniapp/gallery');
    await page.locator('[data-testid="open-filter"]').click();
    await expect(page.locator('[data-testid="bottom-sheet"]')).toBeVisible();
  });

  test('closes on backdrop click', async ({ page }) => {
    await page.goto('/miniapp/gallery');
    await page.locator('[data-testid="open-filter"]').click();
    await page.locator('[data-testid="backdrop"]').click();
    await expect(page.locator('[data-testid="bottom-sheet"]')).not.toBeVisible();
  });

  test('closes on Escape key', async ({ page }) => {
    await page.goto('/miniapp/gallery');
    await page.locator('[data-testid="open-filter"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="bottom-sheet"]')).not.toBeVisible();
  });
});
```

#### Тест формы с валидацией

```typescript
test.describe('Generate Form', () => {
  test('shows validation errors for empty fields', async ({ page }) => {
    await page.goto('/miniapp/generate');
    await page.locator('[data-testid="submit-button"]').click();
    await expect(page.locator('[data-testid="error-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-description"]')).toBeVisible();
  });

  test('submits form with valid data', async ({ page }) => {
    await page.goto('/miniapp/generate');
    await page.fill('[data-testid="input-name"]', 'Test Sticker Pack');
    await page.fill('[data-testid="input-description"]', 'Test description');
    await page.locator('[data-testid="submit-button"]').click();
    await expect(page.locator('.toast-success')).toBeVisible();
  });
});
```

### Best Practices для E2E тестов

1. **Используйте data-testid:**
   ```tsx
   <button data-testid="like-button">Like</button>
   ```

2. **Избегайте селекторов по классам CSS** (они могут измениться)

3. **Ждите элементы явно:**
   ```typescript
   await page.waitForSelector('[data-testid="pack-card"]');
   // вместо
   await page.waitForTimeout(2000); // плохо
   ```

4. **Используйте helpers для повторяющихся действий:**
   ```typescript
   // tests/helpers/common/gallery-helpers.ts
   export async function openPackCard(page: Page, index: number) {
     await page.waitForSelector('[data-testid="pack-card"]');
     await page.locator('[data-testid="pack-card"]').nth(index).click();
     await page.waitForSelector('[data-testid="pack-detail"]');
   }
   ```

5. **Группируйте связанные тесты:**
   ```typescript
   test.describe('Gallery Filters', () => {
     test.beforeEach(async ({ page }) => {
       await setupAuth(page);
       await page.goto('/miniapp/gallery');
     });
     
     test('filters by category', async ({ page }) => { /* ... */ });
     test('filters by date', async ({ page }) => { /* ... */ });
   });
   ```

6. **Используйте fixtures для авторизации:**
   ```typescript
   // Уже реализовано в tests/helpers/common/auth-helpers.ts
   await setupAuth(page);
   ```

---

## Ручное тестирование

Ручное тестирование необходимо для проверки UX, анимаций и edge cases.

### Чек-лист для каждой страницы

См. подробные чек-листы в `docs/visual-testing-checklist.md`

### Сценарии пользователей

#### Сценарий 1: Новый пользователь просматривает галерею

1. Открыть приложение в Telegram
2. Авторизоваться (если требуется)
3. Прокрутить галерею вниз
4. Открыть стикерсет
5. Поставить лайк
6. Вернуться в галерею
7. Использовать поиск
8. Применить фильтр

**Ожидаемый результат:**
- ✅ Все элементы загружаются плавно
- ✅ Анимации работают без лагов
- ✅ Лайки сохраняются
- ✅ Фильтры применяются корректно

#### Сценарий 2: Пользователь создает стикерсет

1. Перейти на страницу Generate
2. Заполнить форму
3. Загрузить изображения
4. Отправить форму
5. Дождаться обработки
6. Проверить результат в галерее

**Ожидаемый результат:**
- ✅ Валидация работает
- ✅ Прогресс загрузки отображается
- ✅ Ошибки показываются понятно
- ✅ Успешное создание подтверждается

#### Сценарий 3: Пользователь управляет профилем

1. Открыть свой профиль
2. Просмотреть статистику
3. Просмотреть свои стикерсеты
4. Открыть стикерсет
5. Выполнить действие (блокировка/удаление)

**Ожидаемый результат:**
- ✅ Статистика корректна
- ✅ Действия выполняются с подтверждением
- ✅ UI обновляется после действий

### Проверка на разных устройствах

#### Мобильные устройства (Telegram Mini App)

**Тестируемые устройства:**
- iPhone 13/14/15 (375x812)
- iPhone SE (375x667)
- Android (360x640, 412x915)
- Планшеты (768x1024)

**Что проверять:**
- ✅ Touch жесты работают
- ✅ Элементы не перекрываются
- ✅ Текст читабелен
- ✅ Кнопки достаточно большие для тапа (min 44x44px)
- ✅ Скролл плавный
- ✅ Клавиатура не перекрывает поля ввода

#### Десктоп (если поддерживается)

**Разрешения:**
- 1920x1080 (Full HD)
- 2560x1440 (2K)
- 3840x2160 (4K)

**Что проверять:**
- ✅ Layout не растягивается слишком широко
- ✅ Центрирование контента
- ✅ Hover состояния работают
- ✅ Клавиатурная навигация (Tab, Enter, Escape)

### Чек-лист производительности

- ✅ Первая загрузка < 3 секунд
- ✅ Time to Interactive < 4 секунд
- ✅ FPS при скролле > 30
- ✅ Нет layout shifts (CLS < 0.1)
- ✅ Размер бандла < 500KB (gzipped)

### Чек-лист accessibility

- ✅ Контрастность текста (WCAG AA минимум)
- ✅ Фокус видимый при Tab навигации
- ✅ Alt текст для изображений
- ✅ ARIA labels для интерактивных элементов
- ✅ Поддержка screen readers

---

## Интеграция в CI/CD

### GitHub Actions пример

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:3000
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Отладка тестов

### Просмотр trace

```bash
npx playwright show-trace trace.zip
```

### Скриншоты при ошибках

Автоматически сохраняются в `test-results/` при падении теста.

### Видео при ошибках

Автоматически записывается в `test-results/` при падении теста.

### Логирование

```typescript
// В тестах можно использовать console.log
console.log('Debug info:', await page.locator('.element').textContent());

// Playwright логирует все запросы/ответы если настроено
page.on('request', request => console.log('Request:', request.url()));
page.on('response', response => console.log('Response:', response.status()));
```

---

## Полезные ресурсы

- [Playwright Documentation](https://playwright.dev/)
- [Visual Testing Guide](https://playwright.dev/docs/test-screenshots)
- [Figma Export Guide](https://help.figma.com/hc/en-us/articles/360040328513)
- [Pixelmatch GitHub](https://github.com/mapbox/pixelmatch)
- [BackstopJS Documentation](https://github.com/garris/BackstopJS)
