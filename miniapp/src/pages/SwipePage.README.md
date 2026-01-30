# SwipePage - Redesigned

## Обзор

SwipePage был полностью переписан под новую дизайн-систему с использованием современных компонентов и добавлением приветственного экрана "Swipe hello".

## Что изменилось

### 1. **Компоненты**
- ❌ Удалены все Material-UI компоненты (Box, Typography, Card)
- ✅ Добавлены новые компоненты:
  - `<Text>` - типографика с вариантами (h1, h2, body, caption)
  - `<Button>` - кнопки с вариантами (primary, secondary, ghost)
  - `<SwipeCardStack>` - компонент для свайп-механики с анимациями
  - `<HeaderPanel>` - панель заголовка с аватаром, балансом ART и кошельком TON

### 2. **Новый функционал**
- ✅ **Swipe hello экран** - приветственное окно для новых пользователей
  - Показывается только при первом посещении страницы Swipe
  - Объясняет механику: "Swipe up - I want to go", "Swipe down - skip"
  - Сохраняется в localStorage (`swipe-hello-shown`)
  - Анимации появления/исчезновения через Framer Motion

### 3. **SwipeCardStack компонент**
- Управляет стеком карточек (до 4 видимых карточек)
- Анимации свайпа через Framer Motion
- Toast уведомления при свайпе (Liked/Skipped)
- Поддержка жестов drag для мобильных устройств

### 4. **Дизайн**
- CSS переменные из `tokens.css`
- Адаптивный дизайн (responsive)
- Фоновые паттерны и градиенты (green/red)
- Поддержка темной/светлой темы

## Структура файлов

```
miniapp/src/pages/
├── SwipePage.tsx           # Основной компонент страницы
└── SwipePage.README.md     # Эта документация

miniapp/src/styles/
└── SwipePage.css           # Стили страницы

miniapp/src/components/ui/
├── SwipeCardStack.tsx      # Компонент стека карточек
├── SwipeCardStack.css      # Стили стека
├── HeaderPanel.tsx         # Панель заголовка
├── HeaderPanel.css         # Стили панели
├── Text.tsx                # Компонент текста
├── Button.tsx              # Компонент кнопки
└── Toast.tsx               # Компонент уведомлений
```

## Используемые хуки и stores

- `useSwipeStickerFeed` - загрузка стикерсетов для свайпа
- `useStickerStore` - глобальное состояние стикерсетов
- `useLikesStore` - управление лайками

## API интеграция

### Свайп влево (skip)
```typescript
const handleSwipeLeft = useCallback((card: any) => {
  const stickerSet = card as StickerSetResponse;
  swipeDislike(stickerSet.id);
}, [swipeDislike]);
```

### Свайп вправо (like)
```typescript
const handleSwipeRight = useCallback(async (card: any) => {
  const stickerSet = card as StickerSetResponse;
  await swipeLike(stickerSet.id);
}, [swipeLike]);
```

## Состояния страницы

1. **Loading** - загрузка стикерсетов
2. **Limit Reached** - достигнут дневной лимит свайпов
3. **Error** - ошибка загрузки
4. **Empty** - все стикерсеты просмотрены
5. **Swipe** - основное состояние со стеком карточек
6. **Hello** - приветственный оверлей (первый визит)

## CSS классы

### Основные контейнеры
- `.swipe-page` - основной контейнер страницы
- `.swipe-page__cards` - контейнер стека карточек
- `.swipe-page__background` - фоновый паттерн
- `.swipe-page__gradient` - градиенты для визуализации свайпа

### Карточки
- `.swipe-card` - карточка стикерсета
- `.swipe-card__content` - заголовок и подзаголовок
- `.swipe-card__preview` - превью стикера
- `.swipe-card__footer` - кнопки и информация

### Приветственный экран
- `.swipe-hello` - оверлей приветственного экрана
- `.swipe-hello__content` - контент приветствия
- `.swipe-hello__instructions` - инструкции по использованию

## Figma референс

Дизайн основан на фрейме "Swipe hello" (ID: 496:1609) из Figma:
- Структура приветственного экрана
- Типографика (Manrope font)
- Цвета и токены
- Компоненты Header panel и Navbar

## Настройки

### localStorage
- `swipe-hello-shown` - флаг показа приветственного экрана

### SwipeCardStack настройки
- `maxVisibleCards: 4` - максимум видимых карточек
- `swipeThreshold: 100` - порог свайпа в пикселях

## Следующие шаги

- [ ] Протестировать на мобильных устройствах
- [ ] Добавить A/B тесты для приветственного экрана
- [ ] Добавить аналитику свайпов
- [ ] Оптимизировать загрузку изображений
- [ ] Добавить звуковые эффекты при свайпе (опционально)

## Troubleshooting

### TypeScript ошибки после изменений
Если видите ошибки импортов в IDE:
1. Перезапустите TypeScript сервер в Cursor/VSCode
2. Убедитесь, что `tsconfig.json` правильно настроен с `baseUrl: "./miniapp"`
3. Очистите кэш: `rm -rf node_modules/.vite`

### Приветственный экран не показывается
Проверьте localStorage:
```javascript
localStorage.removeItem('swipe-hello-shown');
```

## Миграция со старой версии

Старая версия использовала:
- Прямой рендеринг карточек через `SwipeCard` компонент
- Material-UI компоненты
- Нестандартная верстка

Новая версия:
- `SwipeCardStack` для управления стеком
- Новые UI компоненты из дизайн-системы
- Унифицированные стили через CSS-переменные
