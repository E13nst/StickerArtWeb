# BottomSheet Component

Компонент модального окна, который выезжает снизу экрана. Разработан на основе дизайна из Figma (Sheet - Attach, nodeId: 621:1918).

## Особенности

- ✅ Анимация выезда снизу экрана
- ✅ Grabber (полоска для перетаскивания)
- ✅ Закрытие по ESC
- ✅ Закрытие по клику на overlay
- ✅ Focus trap (фокус остается внутри модального окна)
- ✅ Блокировка скролла body при открытии
- ✅ Accessibility (aria-modal, role="dialog")
- ✅ TypeScript типизация
- ✅ Responsive дизайн
- ✅ Использование CSS переменных из tokens.css

## Props

```typescript
interface BottomSheetProps {
  isOpen: boolean;           // Открыто ли модальное окно
  onClose: () => void;       // Callback для закрытия
  title?: string;            // Заголовок (опционально)
  children: React.ReactNode; // Содержимое модального окна
  showCloseButton?: boolean; // Показать кнопку закрытия (по умолчанию true)
  className?: string;        // Дополнительные CSS классы
}
```

## Использование

### Базовый пример

```tsx
import { BottomSheet } from './components/ui';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      
      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Gallery"
      >
        <div>Your content here</div>
      </BottomSheet>
    </>
  );
}
```

### Пример с галереей фотографий

```tsx
<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Recents"
>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
    {photos.map((photo) => (
      <img key={photo.id} src={photo.url} alt={photo.alt} />
    ))}
  </div>
</BottomSheet>
```

### Пример без заголовка

```tsx
<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
>
  <ul>
    <li>Share</li>
    <li>Edit</li>
    <li>Delete</li>
  </ul>
</BottomSheet>
```

## Структура компонента

```
BottomSheet
├── Overlay (полупрозрачный фон)
└── Sheet (контейнер)
    ├── Grabber (полоска для перетаскивания)
    ├── Header (опционально)
    │   ├── Title
    │   └── Close Button
    └── Content (переданный children)
```

## CSS переменные

Компонент использует следующие CSS переменные из `tokens.css`:

- `--color-surface` - фон sheet
- `--color-text` - цвет текста
- `--color-text-secondary` - цвет grabber
- `--color-primary` - цвет focus outline
- `--border-radius-lg` - скругление углов (16px)
- `--spacing-*` - отступы
- `--font-family-base` - шрифт
- `--typography-*` - размеры и стили текста

## Стилизация

Вы можете кастомизировать компонент через:

1. **Props className**:
```tsx
<BottomSheet className="custom-sheet" {...props}>
```

2. **CSS переопределение**:
```css
.bottom-sheet {
  max-height: 70vh; /* Изменить максимальную высоту */
}

.bottom-sheet-content {
  padding: 24px; /* Изменить padding контента */
}
```

## Accessibility

- ✅ `role="dialog"` и `aria-modal="true"`
- ✅ `aria-labelledby` для связи с заголовком
- ✅ Focus trap - Tab и Shift+Tab работают внутри модального окна
- ✅ ESC для закрытия
- ✅ `aria-label` для кнопки закрытия
- ✅ Поддержка `prefers-reduced-motion`

## Responsive поведение

- **Mobile (< 768px)**: Sheet занимает всю ширину экрана, выезжает снизу
- **Desktop (>= 768px)**: Sheet ограничен 600px шириной, центрирован, появляется с fade-in

## Дизайн из Figma

Основано на компоненте "Sheet - Attach" (nodeId: 621:1918):
- Background: #171717 → `--color-surface`
- Border radius: 16px → `--border-radius-lg`
- Grabber: 36x5px, #cfcfcf → `--color-text-secondary`
- Close button: 44x44px, rounded
- Typography: SF Pro/Manrope → `--font-family-base`

## Примеры использования

Смотрите `BottomSheet.example.tsx` для полных примеров использования.
