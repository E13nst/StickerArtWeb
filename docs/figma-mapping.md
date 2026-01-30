# Figma Component Mapping

Маппинг между Figma Node ID и названиями компонентов для проекта StickerArt.

## Основные компоненты

### Navigation

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `435:2688` | Navbar | Нижняя навигационная панель с 5 разделами (Home, Gallery, Swipe, Generation, Account) |

**Навигационные элементы:**
- Background: rgba(255,255,255, 0.2)
- Border Radius: 16px
- Typography: Manrope Regular 400, 8px
- Active Color: #ee449f

### Header Components

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `580:1389` | Header Panel | Верхняя панель с аватаром, балансом и кошельком |

**Header Panel структура:**
- Background: rgba(0,0,0, 0.5)
- Border Radius: 16px
- Height: 172px
- **Balance Frame**: #2f2f2f background, 16px radius
- **Wallet Button**: #007aff background, 16px radius
- Typography: Manrope Bold 700, 16px

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

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `192:225` | Card (Detail View) | Детальный просмотр карточки стикера |
| `378:1121` | Card (Component) | Базовый компонент карточки для свайпа |
| `594:4423` | Card My | Вариант карточки "My" с кнопкой загрузки |

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

### Swipe Stack Components

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `378:1053` | Stack Card Start | Начальное состояние стека |
| `378:1056` | Stack Card Swiped Left | Состояние свайпа влево |
| `378:1061` | Stack Card Swiped Right | Состояние свайпа вправо |
| `378:1066` | Stack Card End | Конечное состояние стека |

### Toast Notifications

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `378:1140` | Toast Green | Уведомление об успехе (#00af12) |
| `378:1142` | Toast Red | Уведомление об ошибке (#e03131) |

### Sheet Components

| Figma ID | Component Name | Description |
|----------|---------------|-------------|
| `621:1918` | Sheet Attach | Модальное окно для прикрепления файлов |

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

## Связанные файлы

- `miniapp/src/styles/design-tokens.json` - JSON с токенами для TypeScript/JavaScript
- `miniapp/src/styles/figma-tokens.css` - CSS-переменные для стилей
- Этот файл - маппинг Figma ID → название компонента

---

*Последнее обновление: 2026-01-30*
*Источник: Figma документ через MCP Talk to Figma*
