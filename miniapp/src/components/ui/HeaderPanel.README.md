# HeaderPanel Component

Компонент шапки профиля пользователя, отображающий аватар, баланс ART токенов и кнопки действий.

## Использование

```tsx
import { HeaderPanel } from '@/components/ui';

function App() {
  return <HeaderPanel />;
}
```

## Props

Компонент **не принимает props**. Все данные получаются из глобальных stores:
- `useTelegram()` - информация о пользователе Telegram
- `useProfileStore()` - баланс ART токенов

## Структура

### Основные элементы:

1. **Avatar** (46x46px)
   - Круглое изображение из `user.photo_url`
   - Placeholder с первой буквой имени, если фото отсутствует

2. **Balance** (140x48px минимум, flex: 1)
   - Текст с форматированием: "11,234 ART"
   - Источник данных: `userInfo.artBalance`
   - Background: `#2f2f2f` (--component-header-panel-balance-background-color)

3. **Plus button** (32x32px)
   - Кнопка для пополнения баланса
   - Background: белый цвет (--color-text)
   - Border-radius: 8px
   - Icon: Plus (+)

4. **Wallet button** (45x48px)
   - Кнопка TON Connect
   - Background: синий (#007aff)
   - Border-radius: 16px
   - Icon: Wallet/Layers

## Стилизация

### CSS переменные из tokens.css:

```css
--component-header-panel-background-color: rgba(0, 0, 0, 0.5)
--component-header-panel-border-radius: 16px
--component-header-panel-height: 172px
--component-header-panel-balance-background-color: #2f2f2f
--component-header-panel-balance-border-radius: 16px
--component-header-panel-wallet-background-color: var(--color-secondary)
--component-header-panel-wallet-border-radius: 16px
```

### Размеры:

- Контейнер: 402x172px (max-width)
- Content: 370x48px (внутренний контент внизу)
- Gap между элементами: 8px (--spacing-sm)

## Поведение

### Условное отображение

Компонент отображается **только если `user !== null`**:

```tsx
if (!user) {
  return null;
}
```

### Форматирование баланса

Баланс форматируется с разделителями тысяч:

```tsx
const formattedBalance = balance.toLocaleString('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
// Пример: 11234 → "11,234"
```

### Обработчики событий

**handlePlusClick** - пополнение баланса:
```tsx
const handlePlusClick = () => {
  // TODO: Открыть модальное окно пополнения баланса
  console.log('Plus button clicked - пополнение баланса');
};
```

**handleWalletClick** - TON Connect:
```tsx
const handleWalletClick = () => {
  // TODO: Подключить TON Connect
  console.log('Wallet button clicked - TON Connect');
};
```

## Адаптивность

### Mobile (max-width: 400px):

- `max-width: 100%` вместо 402px
- Уменьшенный padding в balance блоке
- Уменьшенный font-size (14px вместо 16px)

```css
@media (max-width: 400px) {
  .header-panel {
    max-width: 100%;
  }
  
  .header-panel__balance {
    min-width: unset;
    padding: 0 var(--spacing-sm);
  }
  
  .header-panel__balance-text {
    font-size: 14px;
  }
}
```

## Интеграция с Figma

Компонент создан на основе Figma дизайна (nodeId: "580:1389"):

- **Figma ID**: 580:1389
- **Имя**: "Haeder panel"
- **Размеры**: 402x172px
- **Background**: rgba(0, 0, 0, 0.5)
- **Border-radius**: 16px

### Соответствие дизайну:

| Элемент | Figma | React |
|---------|-------|-------|
| Avatar | 46x46px ELLIPSE | `<img>` 46x46px, border-radius: 50% |
| Balance | 140x48px FRAME | `<div>` flex: 1, min-width: 140px |
| Balance Text | "11,234 ART" Bold 16px | font-size: 16px, font-weight: 700 |
| Plus button | 32x32px FRAME #ffffff | `<button>` 32x32px white |
| Wallet | 45x48px FRAME #007aff | `<button>` 45x48px blue |

## TypeScript

### Типы из useProfileStore:

```typescript
interface UserInfo {
  id: number;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string;
  artBalance: number; // ← используется для баланса
  createdAt: string;
  updatedAt?: string;
  profilePhotoFileId?: string;
  telegramUserInfo?: TelegramUserInfo;
  profilePhotos?: any;
}
```

### Типы из useTelegram:

```typescript
interface TelegramUser {
  id: number;
  first_name: string; // ← используется для placeholder
  last_name?: string;
  username?: string;
  photo_url?: string; // ← используется для аватара
  language_code?: string;
  is_premium?: boolean;
}
```

## Accessibility

- `aria-label` на кнопках для screen readers
- Keyboard navigation support (нативные `<button>`)
- Focus states (браузер по умолчанию)

## TODO

- [ ] Добавить модальное окно пополнения баланса
- [ ] Интегрировать TON Connect SDK
- [ ] Добавить анимации при hover/active
- [ ] Добавить loading состояние для баланса
- [ ] Добавить error состояние если данные не загрузились

## См. также

- [useTelegram hook](../../hooks/useTelegram.ts)
- [useProfileStore](../../store/useProfileStore.ts)
- [Design Tokens](../../styles/tokens.css)
- [HeaderPanel Example](./HeaderPanel.example.tsx)
