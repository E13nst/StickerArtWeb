# Design System Documentation

Полная документация дизайн-системы StickerArtWeb. Дизайн-система построена на основе токенов из Figma и полностью интегрирована с Telegram Mini App темами.

## Оглавление

1. [Обзор](#обзор)
2. [Цветовая палитра](#цветовая-палитра)
3. [Типографика](#типографика)
4. [Spacing и Border Radius](#spacing-и-border-radius)
5. [Компоненты](#компоненты)
6. [CSS-переменные](#css-переменные)
7. [Утилитарные классы](#утилитарные-классы)
8. [Темизация](#темизация)

---

## Обзор

Дизайн-система StickerArtWeb создана для обеспечения единообразия интерфейса и упрощения разработки. Все компоненты используют единые токены дизайна, что обеспечивает:

- ✅ Консистентность визуального стиля
- ✅ Легкую кастомизацию через CSS-переменные
- ✅ Автоматическую поддержку тем Telegram (light/dark)
- ✅ TypeScript типизацию для всех компонентов
- ✅ Accessibility (a11y) поддержку

### Основные принципы

1. **Токены дизайна** - все значения (цвета, размеры, отступы) определены в `design-tokens.json`
2. **CSS-переменные** - токены доступны через CSS custom properties
3. **Компонентный подход** - переиспользуемые UI компоненты в `components/ui/`
4. **Telegram интеграция** - автоматическая адаптация под темы Telegram Mini App

---

## Цветовая палитра

Все цвета определены в `design-tokens.json` и доступны через CSS-переменные. Цвета автоматически адаптируются под тему Telegram.

### Основные цвета

| Токен | CSS-переменная | Значение по умолчанию | Описание |
|-------|----------------|----------------------|----------|
| `primary` | `--color-primary` | `#ee449f` | Основной акцентный цвет (розовый) |
| `secondary` | `--color-secondary` | `#007aff` | Вторичный акцентный цвет (синий) |
| `background` | `--color-background` | `#191818` | Фон приложения |
| `surface` | `--color-surface` | `#262626` | Фон карточек и панелей |
| `surfaceDark` | `--color-surface-dark` | `#2f2f2f` | Темный фон для вложенных элементов |
| `text` | `--color-text` | `#ffffff` | Основной цвет текста |
| `textSecondary` | `--color-text-secondary` | `#8a8a8a` | Вторичный цвет текста (подсказки) |
| `success` | `--color-success` | `#00af12` | Цвет успешных операций |
| `error` | `--color-error` | `#e03131` | Цвет ошибок |
| `border` | `--color-border` | `#8a8a8a` | Цвет границ |

### Overlay цвета

| Токен | CSS-переменная | Значение | Описание |
|-------|----------------|----------|----------|
| `overlay.light` | `--color-overlay-light` | `rgba(255, 255, 255, 0.2)` | Светлый overlay |
| `overlay.dark` | `--color-overlay-dark` | `rgba(0, 0, 0, 0.5)` | Темный overlay |
| `overlay.darkStrong` | `--color-overlay-dark-strong` | `rgba(0, 0, 0, 0.4)` | Сильный темный overlay |
| `overlay.primary` | `--color-overlay-primary` | `rgba(238, 68, 159, 0.2)` | Primary overlay |

### Использование в коде

```tsx
// В CSS
.my-component {
  background-color: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

// В TypeScript/JavaScript
import designTokens from '@/styles/design-tokens.json';
const primaryColor = designTokens.colors.primary; // "#ee449f"
```

---

## Типографика

Типографическая система основана на шрифте **Manrope** и включает 9 вариантов текста.

### Шрифт

- **Font Family**: `Manrope`, `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`, `sans-serif`
- **CSS-переменная**: `--font-family-base`

### Варианты текста

| Вариант | Размер | Вес | Высота строки | HTML элемент | Использование |
|---------|--------|-----|---------------|--------------|----------------|
| `h1` | 32px | 700 (Bold) | 43.71px | `<h1>` | Главные заголовки страниц |
| `h2` | 20px | 700 (Bold) | 22px | `<h2>` | Заголовки разделов |
| `h3` | 16px | 700 (Bold) | 22px | `<h3>` | Подзаголовки |
| `h4` | 16px | 800 (ExtraBold) | 22px | `<h4>` | Акцентные заголовки |
| `body` | 16px | 400 (Regular) | 22px | `<p>` | Основной текст |
| `bodyLarge` | 18px | 400 (Regular) | 24.59px | `<p>` | Увеличенный текст |
| `bodySmall` | 12px | 400 (Regular) | 22px | `<p>` | Мелкий текст |
| `caption` | 8px | 400 (Regular) | 22px | `<span>` | Подписи, метки |
| `light` | 12px | 300 (Light) | 28px | `<span>` | Легкий текст |

### Компонент Text

Используйте компонент `Text` для типографики:

```tsx
import { Text } from '@/components/ui';

// Базовое использование
<Text variant="h1">Заголовок</Text>
<Text variant="body">Основной текст</Text>

// С дополнительными опциями
<Text 
  variant="h2" 
  weight="bold" 
  color="primary" 
  align="center"
>
  Заголовок с акцентом
</Text>
```

### Props компонента Text

```typescript
interface TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySmall' | 'caption' | 'label';
  weight?: 'bold' | 'semibold' | 'regular' | 'light';
  color?: 'primary' | 'secondary' | 'hint' | 'default';
  align?: 'left' | 'center' | 'right';
  as?: keyof JSX.IntrinsicElements; // Переопределить HTML элемент
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
```

### Примеры использования

```tsx
// Заголовки
<Text variant="h1">Главная страница</Text>
<Text variant="h2">Мои стикеры</Text>
<Text variant="h3">Настройки</Text>

// Текст с разными весами
<Text variant="body" weight="bold">Жирный текст</Text>
<Text variant="body" weight="light">Легкий текст</Text>

// Цвета текста
<Text variant="body" color="primary">Акцентный текст</Text>
<Text variant="bodySmall" color="hint">Подсказка</Text>

// Выравнивание
<Text variant="h2" align="center">Центрированный заголовок</Text>

// Переопределение HTML элемента
<Text variant="h1" as="div">Заголовок как div</Text>
```

---

## Spacing и Border Radius

### Spacing (отступы)

Используйте токены spacing для единообразных отступов:

| Токен | Значение | CSS-переменная | Использование |
|-------|----------|----------------|---------------|
| `xs` | 4px | `--spacing-xs` | Минимальные отступы |
| `sm` | 8px | `--spacing-sm` | Маленькие отступы |
| `md` | 16px | `--spacing-md` | Средние отступы (по умолчанию) |
| `lg` | 24px | `--spacing-lg` | Большие отступы |
| `xl` | 32px | `--spacing-xl` | Очень большие отступы |
| `2xl` | 48px | `--spacing-2xl` | Экстра большие отступы |
| `3xl` | 80px | `--spacing-3xl` | Максимальные отступы |

### Использование spacing

```css
/* В CSS */
.card {
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-sm);
}
```

```tsx
// В inline стилях
<div style={{ padding: 'var(--spacing-md)', gap: 'var(--spacing-sm)' }}>
  Content
</div>
```

### Border Radius (скругления)

| Токен | Значение | CSS-переменная | Использование |
|-------|----------|----------------|---------------|
| `sm` | 8px | `--border-radius-sm` | Маленькие скругления |
| `md` | 10px | `--border-radius-md` | Средние скругления (кнопки) |
| `lg` | 16px | `--border-radius-lg` | Большие скругления (карточки) |
| `xl` | 24px | `--border-radius-xl` | Очень большие скругления |
| `2xl` | 30px | `--border-radius-2xl` | Экстра большие скругления |
| `3xl` | 31px | `--border-radius-3xl` | Круглые кнопки |
| `full` | 32px | `--border-radius-full` | Полное скругление |

### Использование border radius

```css
.button {
  border-radius: var(--border-radius-md);
}

.card {
  border-radius: var(--border-radius-lg);
}

.avatar {
  border-radius: var(--border-radius-full);
}
```

---

## Компоненты

### Text

Компонент для типографики. См. раздел [Типографика](#типографика) выше.

**Файл**: `components/ui/Text.tsx`

**Примеры**:
```tsx
<Text variant="h1">Заголовок</Text>
<Text variant="body" color="hint">Подсказка</Text>
```

---

### Button

Кнопка с несколькими вариантами и размерами.

**Файл**: `components/ui/Button.tsx`

#### Варианты (variants)

- `primary` - Основная кнопка (розовый фон)
- `secondary` - Вторичная кнопка (синий фон)
- `outline` - Контурная кнопка (прозрачный фон, цветная рамка)
- `ghost` - Прозрачная кнопка (без фона и рамки)

#### Размеры (sizes)

- `small` - 32px высота
- `medium` - 40px высота (по умолчанию)
- `large` - 48px высота

#### Состояния

- `disabled` - Отключенное состояние
- `loading` - Состояние загрузки (показывает спиннер)

#### Props

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
```

#### Примеры

```tsx
import { Button } from '@/components/ui';

// Основная кнопка
<Button variant="primary" onClick={handleClick}>
  Сохранить
</Button>

// Кнопка с иконкой
<Button variant="secondary" icon={<Icon />}>
  Загрузить
</Button>

// Кнопка загрузки
<Button variant="primary" loading={isLoading}>
  Отправить
</Button>

// Отключенная кнопка
<Button variant="primary" disabled>
  Недоступно
</Button>

// Контурная кнопка
<Button variant="outline" size="small">
  Отмена
</Button>
```

---

### StickerCard

Карточка для отображения стикера с заголовком, изображением и счетчиком лайков.

**Файл**: `components/ui/StickerCard.tsx`

#### Props

```typescript
interface StickerCardProps {
  title: string;
  imageUrl: string;
  likes: number;
  onLikeClick?: (e: React.MouseEvent) => void;
  onCardClick?: () => void;
  className?: string;
}
```

#### Структура

- **Header** - Заголовок карточки
- **Preview** - Изображение стикера
- **Like Badge** - Кнопка с количеством лайков

#### Примеры

```tsx
import { StickerCard } from '@/components/ui';

<StickerCard
  title="Cute Cat"
  imageUrl="/stickers/cat.png"
  likes={42}
  onCardClick={() => navigate('/sticker/123')}
  onLikeClick={(e) => {
    e.stopPropagation();
    handleLike();
  }}
/>
```

---

### Navbar

Нижняя навигационная панель с 5 разделами.

**Файл**: `components/ui/Navbar.tsx`

#### Роуты

| Путь | Label | Icon | Описание |
|------|-------|------|----------|
| `/dashboard` | Home | ⌂ | Главная страница |
| `/gallery` | Gallery | 🖼 | Галерея стикеров |
| `/nft-soon` | Swipe | ⚡ | Свайп стикеров |
| `/generate` | Generation | ✨ | Генерация стикеров |
| `/profile` | Account | 👤 | Профиль пользователя |

#### Активное состояние

Навбар автоматически определяет активный роут через `useLocation()` из `react-router-dom`. Активный таб подсвечивается цветом `--color-primary` (#ee449f).

#### Стилизация

- **Background**: `rgba(255, 255, 255, 0.2)` (полупрозрачный белый)
- **Border Radius**: `16px`
- **Height**: `50px`
- **Font Size**: `8px` (очень маленький для иконок)
- **Active Color**: `#ee449f`

#### Примеры

```tsx
import { Navbar } from '@/components/ui';

// Просто добавьте в layout
<Navbar />
```

---

### HeaderPanel

Верхняя панель профиля с аватаром, балансом ART и кнопками действий.

**Файл**: `components/ui/HeaderPanel.tsx`

#### Интеграция с stores

Компонент автоматически получает данные из:

- **`useTelegram()`** - информация о пользователе Telegram (аватар, имя)
- **`useProfileStore()`** - баланс ART токенов (`userInfo.artBalance`)

#### Структура

1. **Avatar** (46x46px)
   - Изображение из `user.photo_url`
   - Placeholder с первой буквой имени, если фото отсутствует

2. **Balance** (flex: 1, min-width: 140px)
   - Форматированный баланс: "11,234 ART"
   - Background: `#2f2f2f`
   - Border-radius: `16px`

3. **Plus Button** (32x32px)
   - Кнопка пополнения баланса
   - Background: белый
   - Border-radius: `8px`

4. **Wallet Button** (45x48px)
   - Кнопка TON Connect
   - Background: `#007aff` (secondary)
   - Border-radius: `16px`

#### Условное отображение

Компонент отображается **только если пользователь авторизован** (`user !== null`).

#### Примеры

```tsx
import { HeaderPanel } from '@/components/ui';

// Просто добавьте в layout
<HeaderPanel />
```

---

### SwipeCardStack

Интерактивный стек карточек для свайпа (Tinder-like интерфейс).

**Файл**: `components/ui/SwipeCardStack.tsx`

#### Анимации

- **Swipe Left** (Skip): поворот `-20deg`, смещение `-400px`, opacity `0`
- **Swipe Right** (Like): поворот `20deg`, смещение `400px`, opacity `0`
- **Stack Effect**: карточки масштабируются и смещаются по Y для эффекта глубины

#### Callbacks

- `onSwipeLeft(card)` - вызывается при свайпе влево (skip)
- `onSwipeRight(card)` - вызывается при свайпе вправо (like)
- `onEnd()` - вызывается когда все карточки свайпнуты

#### Props

```typescript
interface SwipeCardStackProps {
  cards: SwipeCard[];
  onSwipeLeft: (card: SwipeCard) => void;
  onSwipeRight: (card: SwipeCard) => void;
  onEnd: () => void;
  renderCard: (card: SwipeCard, index: number) => React.ReactNode;
  maxVisibleCards?: number; // По умолчанию 4
  swipeThreshold?: number; // По умолчанию 100px
}
```

#### Примеры

```tsx
import { SwipeCardStack } from '@/components/ui';

const cards = [
  { id: 1, title: 'Card 1', image: '/img1.png' },
  { id: 2, title: 'Card 2', image: '/img2.png' },
];

<SwipeCardStack
  cards={cards}
  onSwipeLeft={(card) => console.log('Skipped:', card)}
  onSwipeRight={(card) => console.log('Liked:', card)}
  onEnd={() => console.log('All cards swiped!')}
  renderCard={(card, index) => (
    <div>
      <img src={card.image} alt={card.title} />
      <h2>{card.title}</h2>
    </div>
  )}
/>
```

#### Toast уведомления

Компонент автоматически показывает toast уведомления:
- "Skipped" (красный) при свайпе влево
- "Liked" (зеленый) при свайпе вправо

---

### BottomSheet

Модальное окно, выезжающее снизу экрана.

**Файл**: `components/ui/BottomSheet.tsx`

#### Особенности

- ✅ Анимация выезда снизу
- ✅ Grabber (полоска для перетаскивания)
- ✅ Закрытие по ESC
- ✅ Закрытие по клику на overlay
- ✅ Focus trap (фокус остается внутри)
- ✅ Блокировка скролла body
- ✅ Accessibility (aria-modal, role="dialog")

#### Props

```typescript
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean; // По умолчанию true
  className?: string;
}
```

#### Примеры

```tsx
import { BottomSheet } from '@/components/ui';

const [isOpen, setIsOpen] = useState(false);

<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Gallery"
>
  <div>Your content here</div>
</BottomSheet>
```

---

### UploadModal

Модальное окно для загрузки файлов с поддержкой drag-and-drop.

**Файл**: `components/ui/UploadModal.tsx`

#### Особенности

- ✅ Drag-and-drop загрузка
- ✅ Клик для выбора файлов
- ✅ Валидация размера файлов
- ✅ Отображение списка выбранных файлов
- ✅ Закрытие по ESC и клику на overlay
- ✅ Focus trap и accessibility

#### Props

```typescript
interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  title?: string; // По умолчанию "Add stickers to Stixly"
  accept?: string; // По умолчанию "image/*"
  multiple?: boolean; // По умолчанию true
  maxSize?: number; // По умолчанию 10 MB
  className?: string;
}
```

#### Примеры

```tsx
import { UploadModal } from '@/components/ui';

const [isOpen, setIsOpen] = useState(false);

const handleUpload = (files: File[]) => {
  console.log('Uploaded:', files);
  // Обработка загрузки
};

<UploadModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onUpload={handleUpload}
  title="Add stickers"
  accept="image/*"
  multiple={true}
  maxSize={10}
/>
```

---

### Avatar

Компонент для отображения аватаров пользователей.

**Файл**: `components/ui/Avatar.tsx`

#### Props

```typescript
interface AvatarProps {
  src?: string; // URL изображения
  alt?: string; // Alt текст
  children?: React.ReactNode; // Инициалы или fallback контент
  size?: number; // Размер в px (по умолчанию 40)
  style?: React.CSSProperties;
  className?: string;
}
```

#### Примеры

```tsx
import { Avatar } from '@/components/ui';

// С изображением
<Avatar src="/avatar.jpg" alt="User" size={48} />

// С инициалами
<Avatar size={48}>JD</Avatar>
```

---

### Chip

Компактный компонент для отображения меток и тегов.

**Файл**: `components/ui/Chip.tsx`

#### Варианты

- `filled` - Заполненный (по умолчанию)
- `outlined` - Контурный

#### Размеры

- `small` - Маленький
- `medium` - Средний (по умолчанию)

#### Props

```typescript
interface ChipProps {
  label: React.ReactNode;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void; // Делает chip кликабельным
}
```

#### Примеры

```tsx
import { Chip } from '@/components/ui';

// Базовый chip
<Chip label="React" />

// Контурный chip
<Chip label="TypeScript" variant="outlined" />

// Кликабельный chip
<Chip label="Click me" onClick={() => console.log('Clicked')} />

// Маленький chip
<Chip label="Small" size="small" />
```

---

### Card

Базовый компонент карточки для группировки контента.

**Файл**: `components/ui/Card.tsx`

#### Компоненты

- `Card` - Основной контейнер карточки
- `CardContent` - Контент внутри карточки

#### Props

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void; // Делает карточку кликабельной
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
```

#### Примеры

```tsx
import { Card, CardContent } from '@/components/ui';

// Базовая карточка
<Card>
  <CardContent>
    <h2>Заголовок</h2>
    <p>Контент карточки</p>
  </CardContent>
</Card>

// Кликабельная карточка
<Card onClick={() => navigate('/details')}>
  <CardContent>Click me</CardContent>
</Card>
```

---

## CSS-переменные

Все токены дизайна доступны через CSS custom properties (переменные). Это позволяет легко кастомизировать стили и поддерживать темизацию.

### Импорт переменных

```css
/* Импортируйте tokens.css в главный CSS файл */
@import '@/styles/tokens.css';
```

### Использование в CSS

```css
.my-component {
  /* Цвета */
  background-color: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  
  /* Типографика */
  font-family: var(--font-family-base);
  font-size: var(--typography-body-font-size);
  
  /* Spacing */
  padding: var(--spacing-md);
  margin: var(--spacing-lg);
  gap: var(--spacing-sm);
  
  /* Border Radius */
  border-radius: var(--border-radius-lg);
}
```

### Использование в inline стилях

```tsx
<div style={{
  backgroundColor: 'var(--color-surface)',
  padding: 'var(--spacing-md)',
  borderRadius: 'var(--border-radius-lg)'
}}>
  Content
</div>
```

### Полный список переменных

См. файл `miniapp/src/styles/tokens.css` для полного списка всех доступных CSS-переменных.

---

## Утилитарные классы

В файле `common.css` определены утилитарные классы для быстрой стилизации.

### Layout классы

```css
.flex-center          /* display: flex; align-items: center; justify-content: center; */
.flex-column-center   /* flex-direction: column; align-items: center; justify-content: center; */
.flex-column-start    /* flex-direction: column; align-items: center; justify-content: flex-start; */
.flex-row-center      /* flex-direction: row; align-items: center; justify-content: center; */
.flex-row-space-around /* justify-content: space-around; align-items: center; flex-wrap: wrap; */
.flex-row             /* display: flex; align-items: center; */
.text-center          /* text-align: center; */
```

### Page контейнеры

```css
.page-container                    /* Базовый контейнер страницы */
.page-container.telegram-app       /* Для Telegram Mini App */
.page-container-full-height        /* Полная высота без padding-bottom */
.page-container-no-margin-top      /* Без верхнего margin */
.page-container-no-padding-top     /* Без верхнего padding */
.page-container-padding-y          /* Padding по вертикали */
```

### Card классы

```css
.card-base                         /* Базовая карточка с border-radius и фоном */
.card-base-no-padding-top         /* Карточка без верхнего padding */
.card-content-base                /* Базовый контент карточки */
.card-content-with-avatar         /* Контент с аватаром (padding-top: 2xl) */
```

### Button классы

```css
.button-base                       /* Базовые стили кнопки */
.button-rounded                   /* border-radius: 999px */
.button-rounded-sm                 /* border-radius: var(--border-radius-sm) */
.button-rounded-md                 /* border-radius: var(--border-radius-md) */
.button-rounded-lg                 /* border-radius: var(--border-radius-lg) */
```

### Typography классы

```css
.text-primary                      /* color: var(--color-primary) */
.text-hint                         /* color: var(--color-text-secondary) */
.text-default                      /* color: var(--color-text) */
.typography-bold                   /* font-weight: 600 */
.typography-h5-bold                /* font-weight: bold; color: var(--color-primary) */
.typography-body2-hint             /* color: var(--color-text-secondary) */
```

### Padding классы

```css
.p-1                               /* padding: 1rem */
.p-1-5                             /* padding: 1.5rem */
.px-1                              /* padding-left/right: 1rem */
.px-1-5                            /* padding-left/right: 1.5rem */
.py-1                              /* padding-top/bottom: 1rem */
.py-1-5                            /* padding-top/bottom: 1.5rem */
.py-3                              /* padding-top/bottom: 3rem */
```

### Margin классы

```css
.mt-1-5                            /* margin-top: 1.5rem */
.mb-1-5                            /* margin-bottom: 1.5rem */
.mb-2                              /* margin-bottom: 2rem */
.mt-2                              /* margin-top: 2rem */
```

### Utility классы

```css
.relative                          /* position: relative */
.absolute                          /* position: absolute */
.z-index-10                       /* z-index: 10 */
.z-index-30                       /* z-index: 30 */
```

### Примеры использования

```tsx
// Layout
<div className="flex-center">
  <div>Centered content</div>
</div>

// Page container
<div className="page-container">
  <div className="card-base">
    <div className="card-content-base">
      Content
    </div>
  </div>
</div>

// Typography
<p className="text-primary typography-bold">Bold primary text</p>
```

---

## Темизация

Дизайн-система полностью поддерживает темизацию через Telegram Mini App API. Цвета автоматически адаптируются под тему пользователя.

### Telegram темы

Telegram предоставляет CSS-переменные через `--tg-theme-*`:

| Telegram переменная | Наша переменная | Описание |
|---------------------|-----------------|----------|
| `--tg-theme-bg-color` | `--color-background` | Фон приложения |
| `--tg-theme-secondary-bg-color` | `--color-surface` | Фон карточек |
| `--tg-theme-text-color` | `--color-text` | Цвет текста |
| `--tg-theme-hint-color` | `--color-text-secondary` | Цвет подсказок |
| `--tg-theme-link-color` | `--color-secondary` | Цвет ссылок |
| `--tg-theme-button-color` | `--color-primary` | Цвет кнопок |
| `--tg-theme-button-text-color` | `#ffffff` | Цвет текста кнопок |
| `--tg-theme-border-color` | `--color-border` | Цвет границ |

### Как это работает

В файле `tokens.css` определены fallback значения:

```css
:root {
  --color-background: var(--tg-theme-bg-color, #191818);
  --color-surface: var(--tg-theme-secondary-bg-color, #262626);
  --color-text: var(--tg-theme-text-color, #ffffff);
  /* ... */
}
```

Если Telegram переменные доступны, они используются. Иначе используются значения по умолчанию.

### Light/Dark темы

Telegram автоматически переключает темы через свои переменные. Наша дизайн-система автоматически адаптируется.

### Кастомная темизация

Вы можете переопределить переменные для кастомных тем:

```css
[data-theme="custom"] {
  --color-primary: #ff0000;
  --color-background: #ffffff;
  /* ... */
}
```

### Проверка темы

```tsx
// В компоненте
const theme = window.Telegram?.WebApp?.colorScheme; // 'light' | 'dark'
```

---

## Дополнительные ресурсы

- **Design Tokens**: `miniapp/src/styles/design-tokens.json`
- **CSS Tokens**: `miniapp/src/styles/tokens.css`
- **Figma Tokens**: `miniapp/src/styles/figma-tokens.css`
- **Common Styles**: `miniapp/src/styles/common.css`
- **Typography Styles**: `miniapp/src/styles/typography.css`
- **Figma Mapping**: `docs/figma-mapping.md`
- **Migration Guide**: `docs/migration-guide.md`

---

*Последнее обновление: 2026-01-30*
