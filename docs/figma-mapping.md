# Figma Component Mapping

Маппинг между Figma Node ID и названиями компонентов для проекта StickerArt.

## Основные компоненты

### Navigation

| Figma ID | Component Name | React Component | Description |
|----------|---------------|-----------------|-------------|
| `435:2688` | Navbar | [`Navbar`](../miniapp/src/components/ui/Navbar.tsx) | Нижняя навигационная панель с 5 разделами (Home, Gallery, Swipe, Generation, Account) |

**Навигационные элементы:**
- Background: rgba(255,255,255, 0.2)
- Border Radius: 16px
- Typography: Manrope Regular 400, 8px
- Active Color: #ee449f

**Использование:**
```tsx
import { Navbar } from '@/components/ui';
<Navbar />
```

### Header Components

| Figma ID | Component Name | React Component | Description |
|----------|---------------|-----------------|-------------|
| `580:1389` | Header Panel | [`HeaderPanel`](../miniapp/src/components/ui/HeaderPanel.tsx) | Верхняя панель с аватаром, балансом и кошельком |

**Header Panel структура:**
- Background: rgba(0,0,0, 0.5)
- Border Radius: 16px
- Height: 172px
- **Balance Frame**: #2f2f2f background, 16px radius
- **Wallet Button**: #007aff background, 16px radius
- Typography: Manrope Bold 700, 16px

**Использование:**
```tsx
import { HeaderPanel } from '@/components/ui';
<HeaderPanel />
```

**Документация:** См. [HeaderPanel README](../miniapp/src/components/ui/HeaderPanel.README.md)

### Pages

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `164:768` | Gallery | Страница галереи со списком стикеров |

**Gallery Page элементы:**
- Background: #191818
- Card Background: rgba(238, 68, 159, 0.2)
- Card Border Radius: 16px
- Search Bar: #262626, radius 30px
- "CREATE STICKERSET" Button: #ee449f, radius 10px

### Card Components

| Figma ID | Component Name | React Component | Description |
|----------|---------------|-----------------|-------------|
| `192:225` | Card (Detail View) | [`Card`](../miniapp/src/components/ui/Card.tsx) | Детальный просмотр карточки стикера |
| `378:1121` | Card (Component) | [`StickerCard`](../miniapp/src/components/ui/StickerCard.tsx) | Базовый компонент карточки для свайпа |
| `594:4423` | Card My | [`Card`](../miniapp/src/components/ui/Card.tsx) | Вариант карточки "My" с кнопкой загрузки |

**Card общие свойства:**
- Background: #262626
- Border Radius: 16px
- Width: 370px
- **Title**: Manrope Bold 700, 32px
- **Subtitle**: Manrope Regular 400, 18px, color #ee449f
- **Buttons**:
  - Success (Right): #00af12, radius 31px, size 56px
  - Error (Left): #e03131, radius 31px, size 56px
  - Download: #8a8a8a, radius 16px, height 48px
  - Primary: #ee449f, radius 10px, height 44px

**Использование:**
```tsx
import { Card, CardContent, StickerCard } from '@/components/ui';

// Базовая карточка
<Card>
  <CardContent>Content</CardContent>
</Card>

// Карточка стикера
<StickerCard
  title="Cute Cat"
  imageUrl="/stickers/cat.png"
  likes={42}
  onCardClick={() => navigate('/sticker/123')}
/>
```

### Swipe Stack Components

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `378:1053` | Stack Card Start | Начальное состояние стека |
| `378:1056` | Stack Card Swiped Left | Состояние свайпа влево |
| `378:1061` | Stack Card Swiped Right | Состояние свайпа вправо |
| `378:1066` | Stack Card End | Конечное состояние стека |

### Toast Notifications

| Figma ID | Component Name | React Component | Description |
|----------|---------------|-----------------|-------------|
| `378:1140` | Toast Green | [`Toast`](../miniapp/src/components/ui/Toast.tsx) | Уведомление об успехе (#00af12) |
| `378:1142` | Toast Red | [`Toast`](../miniapp/src/components/ui/Toast.tsx) | Уведомление об ошибке (#e03131) |

**Использование:**
```tsx
import { Toast } from '@/components/ui';

<Toast
  message="Success!"
  type="success"
  isVisible={showToast}
  onClose={() => setShowToast(false)}
/>
```

### Sheet Components

| Figma ID | Component Name | React Component | Description |
|----------|---------------|-----------------|-------------|
| `621:1918` | Sheet Attach | [`BottomSheet`](../miniapp/src/components/ui/BottomSheet.tsx) | Модальное окно для прикрепления файлов |

**Использование:**
```tsx
import { BottomSheet } from '@/components/ui';

<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Gallery"
>
  Content
</BottomSheet>
```

**Документация:** См. [BottomSheet README](../miniapp/src/components/ui/BottomSheet.README.md)

### Upload Components

| Figma ID | Component Name | React Component | Description |
|----------|---------------|-----------------|-------------|
| `735:1422`, `736:1467` | Upload Modal | [`UploadModal`](../miniapp/src/components/ui/UploadModal.tsx) | Модальное окно для загрузки файлов |

**Использование:**
```tsx
import { UploadModal } from '@/components/ui';

<UploadModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onUpload={(files) => console.log('Uploaded:', files)}
  title="Add stickers"
/>
```

**Документация:** См. [UploadModal README](../miniapp/src/components/ui/UploadModal.README.md)

## Дизайн-токены

### Цвета

```json
{
  "primary": "#ee449f",
  "secondary": "#007aff",
  "background": "#191818",
  "surface": "#262626",
  "surfaceDark": "#2f2f2f",
  "success": "#00af12",
  "error": "#e03131",
  "text": "#ffffff",
  "textSecondary": "#8a8a8a"
}
```

### Типографика

**Font Family:** Manrope

| Style | Size | Weight | Line Height |
|-------|------|--------|-------------|
| H1 | 32px | 700 (Bold) | 43.71px |
| H2 | 20px | 700 (Bold) | 22px |
| H3 | 16px | 700 (Bold) | 22px |
| H4 | 16px | 800 (ExtraBold) | 22px |
| Body | 16px | 400 (Regular) | 22px |
| Body Large | 18px | 400 (Regular) | 24.59px |
| Body Small | 12px | 400 (Regular) | 22px |
| Caption | 8px | 400 (Regular) | 22px |
| Light | 12px | 300 (Light) | 28px |

### Border Radius

| Token | Value |
|-------|-------|
| sm | 8px |
| md | 10px |
| lg | 16px |
| xl | 24px |
| 2xl | 30px |
| 3xl | 31px |
| full | 32px |

### Spacing

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |
| 3xl | 80px |

## Компонентная библиотека

### Button Variants

| Figma ID Pattern | Variant | Background | Radius |
|-----------------|---------|------------|--------|
| `Property 1=Default` | Default state | Varies | 16px |
| `Property 1=Variant2` | Hover/Active | Varies | 16px |
| `Property 1=Variant3` | Disabled | Varies | 16px |
| `Property 1=Variant4` | Loading | Varies | 16px |

### Stack Positions

Компоненты свайп-стека имеют следующую структуру ID:
- `Stack=N, Position=Start` - начальная позиция N-го стека
- `Stack=N, Position=Swiped Left` - свайп влево
- `Stack=N, Position=Swiped Right` - свайп вправо
- `Stack=N, Position=End` - конечная позиция

Где N может быть 1, 2, 3, или 4.

## Использование

### В коде

```typescript
import designTokens from '@/styles/design-tokens.json';

// Использование цветов
const primaryColor = designTokens.colors.primary; // "#ee449f"

// Использование типографики
const h1Style = {
  fontSize: designTokens.typography.h1.fontSize,
  fontWeight: designTokens.typography.h1.fontWeight,
  lineHeight: designTokens.typography.h1.lineHeight
};
```

### В CSS

```css
/* Импортируйте CSS переменные */
@import '@/styles/figma-tokens.css';

/* Используйте токены */
.button-primary {
  background-color: var(--color-primary);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-md);
}
```

## UI Компоненты

Все компоненты находятся в `miniapp/src/components/ui/`:

| Компонент | Файл | Описание |
|-----------|------|----------|
| `Text` | [`Text.tsx`](../miniapp/src/components/ui/Text.tsx) | Типографика (замена Typography) |
| `Button` | [`Button.tsx`](../miniapp/src/components/ui/Button.tsx) | Кнопки с вариантами и размерами |
| `Card` / `CardContent` | [`Card.tsx`](../miniapp/src/components/ui/Card.tsx) | Базовые карточки |
| `StickerCard` | [`StickerCard.tsx`](../miniapp/src/components/ui/StickerCard.tsx) | Карточка стикера |
| `Navbar` | [`Navbar.tsx`](../miniapp/src/components/ui/Navbar.tsx) | Нижняя навигация |
| `HeaderPanel` | [`HeaderPanel.tsx`](../miniapp/src/components/ui/HeaderPanel.tsx) | Верхняя панель профиля |
| `SwipeCardStack` | [`SwipeCardStack.tsx`](../miniapp/src/components/ui/SwipeCardStack.tsx) | Стек карточек для свайпа |
| `BottomSheet` | [`BottomSheet.tsx`](../miniapp/src/components/ui/BottomSheet.tsx) | Модальное окно снизу |
| `UploadModal` | [`UploadModal.tsx`](../miniapp/src/components/ui/UploadModal.tsx) | Модальное окно загрузки |
| `Avatar` | [`Avatar.tsx`](../miniapp/src/components/ui/Avatar.tsx) | Аватар пользователя |
| `Chip` | [`Chip.tsx`](../miniapp/src/components/ui/Chip.tsx) | Метки и теги |
| `Toast` | [`Toast.tsx`](../miniapp/src/components/ui/Toast.tsx) | Уведомления |
| `Icons` | [`Icons.tsx`](../miniapp/src/components/ui/Icons.tsx) | SVG иконки |

**Импорт всех компонентов:**
```tsx
import { 
  Text, 
  Button, 
  Card, 
  CardContent,
  StickerCard,
  Navbar,
  HeaderPanel,
  SwipeCardStack,
  BottomSheet,
  UploadModal,
  Avatar,
  Chip,
  Toast
} from '@/components/ui';
```

## Связанные файлы

- [`design-tokens.json`](../miniapp/src/styles/design-tokens.json) - JSON с токенами для TypeScript/JavaScript
- [`tokens.css`](../miniapp/src/styles/tokens.css) - CSS-переменные для стилей
- [`figma-tokens.css`](../miniapp/src/styles/figma-tokens.css) - CSS-переменные из Figma
- [`common.css`](../miniapp/src/styles/common.css) - Утилитарные классы
- [`typography.css`](../miniapp/src/styles/typography.css) - Типографические стили
- [`design-system.md`](./design-system.md) - Полная документация дизайн-системы
- [`migration-guide.md`](./migration-guide.md) - Гайд по миграции с MUI
- Этот файл - маппинг Figma ID → React компонент

---

*Последнее обновление: 2026-01-30*
*Источник: Figma документ через MCP Talk to Figma*
