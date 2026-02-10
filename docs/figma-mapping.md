# Figma Component Mapping

Маппинг Figma Node ID → компоненты и токены для проекта StickerArt. Используется для синхронизации с макетом (MCP Talk to Figma) и при верстке.

## Оглавление

1. [Компоненты](#компоненты)
   - [Navigation](#navigation)
   - [Header](#header-components)
   - [Страницы](#pages)
   - [Карточки](#card-components)
   - [Swipe Stack](#swipe-stack-components)
   - [Toast](#toast-notifications)
   - [Sheet и модалки](#sheet-и-модалки)
2. [Дизайн-токены](#дизайн-токены)
3. [Использование](#использование)
4. [Связанные файлы](#связанные-файлы)

---

## Компоненты

### Navigation

| Figma ID | Компонент | React | Описание |
|----------|-----------|-------|----------|
| `435:2688` | Navbar | [`Navbar`](../miniapp/src/components/ui/Navbar.tsx) | Нижняя навигация: Home, Gallery, Swipe, Generation, Account |

**Свойства:** Background `rgba(255,255,255, 0.2)`, Border Radius 16px, Manrope Regular 8px, активный цвет `#ee449f`.

```tsx
import { Navbar } from '@/components/ui';
<Navbar />
```

---

### Header Components

| Figma ID | Компонент | React | Описание |
|----------|-----------|-------|----------|
| `580:1389` | Header Panel | [`HeaderPanel`](../miniapp/src/components/ui/HeaderPanel.tsx) | Верхняя панель: аватар, баланс ART, кошелёк |

**Свойства:** Background `rgba(0,0,0, 0.5)`, Border Radius 16px, высота 172px. Balance: `#2f2f2f`, 16px radius. Wallet: `#007aff`, 16px radius. Типографика: Manrope Bold 16px.

**Документация:** [HeaderPanel README](../miniapp/src/components/ui/HeaderPanel.README.md)

```tsx
import { HeaderPanel } from '@/components/ui';
<HeaderPanel />
```

---

### Pages

| Figma ID | Компонент | Описание |
|----------|-----------|----------|
| `164:768` | Gallery | Страница галереи со списком стикеров |

**Элементы:** Background `#191818`, карточка `rgba(238, 68, 159, 0.2)` 16px radius, поиск `#262626` 30px radius, кнопка "CREATE STICKERSET" `#ee449f` 10px radius.

---

### Card Components

| Figma ID | Компонент | React | Описание |
|----------|-----------|-------|----------|
| `192:225` | Card (Detail View) | [`Card`](../miniapp/src/components/ui/Card.tsx) | Детальный просмотр карточки |
| `378:1121` | Card (Swipe) | [`StickerCard`](../miniapp/src/components/ui/StickerCard.tsx) | Карточка для свайпа |
| `594:4423` | Card My | [`Card`](../miniapp/src/components/ui/Card.tsx) | Вариант «My» с кнопкой загрузки |

**Общие свойства:** Background `#262626`, Border Radius 16px, ширина 370px. Title: Manrope Bold 32px. Subtitle: 18px `#ee449f`. Кнопки: Success `#00af12`, Error `#e03131` 31px radius 56px; Download `#8a8a8a` 16px 48px; Primary `#ee449f` 10px 44px.

```tsx
import { Card, CardContent, StickerCard } from '@/components/ui';
<Card><CardContent>Content</CardContent></Card>
<StickerCard title="Cute Cat" imageUrl="/stickers/cat.png" likes={42} onCardClick={() => {}} />
```

---

### Swipe Stack Components

| Figma ID | Компонент | Описание |
|----------|-----------|----------|
| `378:1053` | Stack Card Start | Начальное состояние стека |
| `378:1056` | Stack Card Swiped Left | Свайп влево |
| `378:1061` | Stack Card Swiped Right | Свайп вправо |
| `378:1066` | Stack Card End | Конечное состояние |

Структура ID в Figma: `Stack=N, Position=Start|Swiped Left|Swiped Right|End` (N = 1–4).

---

### Toast Notifications

| Figma ID | Компонент | React | Описание |
|----------|-----------|-------|----------|
| `378:1140` | Toast Green | [`Toast`](../miniapp/src/components/ui/Toast.tsx) | Успех `#00af12` |
| `378:1142` | Toast Red | [`Toast`](../miniapp/src/components/ui/Toast.tsx) | Ошибка `#e03131` |

```tsx
import { Toast } from '@/components/ui';
<Toast message="Success!" type="success" isVisible={show} onClose={() => setShow(false)} />
```

---

### Sheet и модалки

| Figma ID | Компонент | React | Описание |
|----------|-----------|-------|----------|
| `621:1918` | Sheet Attach | [`BottomSheet`](../miniapp/src/components/ui/BottomSheet.tsx) | Модальное окно прикрепления файлов |
| `735:1422`, `736:1467` | Upload Modal | [`UploadModal`](../miniapp/src/components/ui/UploadModal.tsx) | Модальное окно загрузки |

**BottomSheet:** [README](../miniapp/src/components/ui/BottomSheet.README.md)  
**UploadModal:** [README](../miniapp/src/components/ui/UploadModal.README.md)

```tsx
import { BottomSheet, UploadModal } from '@/components/ui';
<BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Gallery">Content</BottomSheet>
<UploadModal isOpen={isOpen} onClose={() => setIsOpen(false)} onUpload={(f) => {}} title="Add stickers" />
```

---

## Дизайн-токены

Краткая сводка. Полный список и использование — в [design-system.md](./design-system.md) и в файлах токенов.

| Категория | Токены / значения |
|-----------|--------------------|
| **Цвета** | `primary` #ee449f, `secondary` #007aff, `background` #191818, `surface` #262626, `surfaceDark` #2f2f2f, `success` #00af12, `error` #e03131, `text` #ffffff, `textSecondary` #8a8a8a |
| **Типографика** | Manrope: H1 32px/700, H2 20px/700, H3 16px/700, H4 16px/800, Body 16px/400, Body Large 18px/400, Caption 8px/400 |
| **Border Radius** | sm 8px, md 10px, lg 16px, xl 24px, 2xl 30px, 3xl 31px, full 32px |
| **Spacing** | xs 4px, sm 8px, md 16px, lg 24px, xl 32px, 2xl 48px, 3xl 80px |

### Варианты кнопок в Figma

| Figma Pattern | Вариант |
|---------------|---------|
| `Property 1=Default` | Default |
| `Property 1=Variant2` | Hover/Active |
| `Property 1=Variant3` | Disabled |
| `Property 1=Variant4` | Loading |

---

## Использование

### В коде

```typescript
import designTokens from '@/styles/design-tokens.json';
const primaryColor = designTokens.colors.primary;
```

### В CSS

```css
@import '@/styles/figma-tokens.css';
.button-primary {
  background-color: var(--color-primary);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-md);
}
```

### Импорт UI-компонентов

Все компоненты в `miniapp/src/components/ui/`:

| Компонент | Файл |
|-----------|------|
| Text, Button, Card, CardContent, StickerCard | [`Text`](../miniapp/src/components/ui/Text.tsx), [`Button`](../miniapp/src/components/ui/Button.tsx), [`Card`](../miniapp/src/components/ui/Card.tsx), [`StickerCard`](../miniapp/src/components/ui/StickerCard.tsx) |
| Navbar, HeaderPanel, SwipeCardStack | [`Navbar`](../miniapp/src/components/ui/Navbar.tsx), [`HeaderPanel`](../miniapp/src/components/ui/HeaderPanel.tsx), [`SwipeCardStack`](../miniapp/src/components/ui/SwipeCardStack.tsx) |
| BottomSheet, UploadModal, Avatar, Chip, Toast, Icons | [`BottomSheet`](../miniapp/src/components/ui/BottomSheet.tsx), [`UploadModal`](../miniapp/src/components/ui/UploadModal.tsx), [`Avatar`](../miniapp/src/components/ui/Avatar.tsx), [`Chip`](../miniapp/src/components/ui/Chip.tsx), [`Toast`](../miniapp/src/components/ui/Toast.tsx), [`Icons`](../miniapp/src/components/ui/Icons.tsx) |

```tsx
import {
  Text, Button, Card, CardContent, StickerCard,
  Navbar, HeaderPanel, SwipeCardStack,
  BottomSheet, UploadModal, Avatar, Chip, Toast
} from '@/components/ui';
```

---

## Связанные файлы

| Файл | Назначение |
|------|------------|
| [design-tokens.json](../miniapp/src/styles/design-tokens.json) | JSON-токены для TS/JS |
| [tokens.css](../miniapp/src/styles/tokens.css) | CSS-переменные (основные) |
| [figma-tokens.css](../miniapp/src/styles/figma-tokens.css) | CSS-переменные из Figma |
| [common.css](../miniapp/src/styles/common.css) | Утилитарные классы |
| [typography.css](../miniapp/src/styles/typography.css) | Типографика |
| [design-system.md](./design-system.md) | Документация дизайн-системы |
| [migration-guide.md](./migration-guide.md) | Миграция с MUI |

*Маппинг Figma ID → React-компонент. Источник: Figma через MCP Talk to Figma. Обновлено: 2026-02-10.*
