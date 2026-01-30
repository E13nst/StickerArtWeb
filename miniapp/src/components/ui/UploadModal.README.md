# UploadModal Component

Компонент модального окна для загрузки файлов с поддержкой drag-and-drop. Разработан на основе дизайна из Figma (UPLOAD, nodeId: 735:1422 и 736:1467).

## Особенности

- ✅ Drag-and-drop загрузка файлов
- ✅ Клик для выбора файлов
- ✅ Валидация размера файлов
- ✅ Отображение списка выбранных файлов
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
interface UploadModalProps {
  isOpen: boolean;                  // Открыто ли модальное окно
  onClose: () => void;              // Callback для закрытия
  onUpload: (files: File[]) => void;// Callback для загрузки файлов
  title?: string;                   // Заголовок (по умолчанию "Add stickers to Stixly")
  accept?: string;                  // MIME типы файлов (по умолчанию "image/*")
  multiple?: boolean;               // Множественный выбор (по умолчанию true)
  maxSize?: number;                 // Максимальный размер в MB (по умолчанию 10)
  className?: string;               // Дополнительные CSS классы
}
```

## Использование

### Базовый пример

```tsx
import { UploadModal } from './components/ui';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  const handleUpload = (files: File[]) => {
    console.log('Uploaded files:', files);
    // Обработка загруженных файлов
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Upload Files</button>
      
      <UploadModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUpload={handleUpload}
      />
    </>
  );
}
```

### Пример с кастомными настройками

```tsx
<UploadModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onUpload={handleUpload}
  title="Add stickers to Stixly"
  accept="image/png,image/jpeg,image/webp"
  multiple={true}
  maxSize={5}
/>
```

### Пример с одним файлом

```tsx
<UploadModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onUpload={handleUpload}
  title="Upload Profile Picture"
  accept="image/*"
  multiple={false}
  maxSize={2}
/>
```

### Пример с документами

```tsx
<UploadModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onUpload={handleUpload}
  title="Upload Documents"
  accept=".pdf,.doc,.docx,.txt"
  multiple={true}
  maxSize={20}
/>
```

## Структура компонента

```
UploadModal
├── Overlay (полупрозрачный фон)
└── Modal (центрированный контейнер)
    ├── Header
    │   ├── Title
    │   └── Close Button
    ├── Content
    │   ├── Subtitle (описание)
    │   ├── Drop Zone (drag-and-drop область)
    │   ├── Error Message (если есть ошибка)
    │   └── Files List (список выбранных файлов)
    └── Footer
        ├── Cancel Button
        └── Upload Button
```

## CSS переменные

Компонент использует следующие CSS переменные из `tokens.css`:

- `--color-surface` - фон модального окна (#262626)
- `--color-background` - фон drop zone (#171717)
- `--color-text` - цвет текста (#ffffff)
- `--color-text-secondary` - цвет подзаголовка (#8a8a8a)
- `--color-border` - цвет рамки (#8a8a8a)
- `--color-primary` - цвет кнопки Upload (#ee449f)
- `--color-error` - цвет сообщений об ошибках
- `--border-radius-lg` - скругление углов (16px)
- `--border-radius-md` - скругление кнопок (10px)
- `--spacing-*` - отступы
- `--font-family-base` - шрифт (Manrope)
- `--typography-*` - размеры и стили текста

## Валидация файлов

Компонент автоматически валидирует:

1. **Размер файла**: Если файл превышает `maxSize`, показывается сообщение об ошибке
2. **Тип файла**: Браузер автоматически фильтрует по `accept` атрибуту

Пример обработки ошибок:

```tsx
const handleUpload = (files: File[]) => {
  if (files.length === 0) {
    alert('No files selected');
    return;
  }

  // Загрузка файлов на сервер
  uploadFiles(files)
    .then(() => {
      alert('Upload successful!');
    })
    .catch((error) => {
      alert(`Upload failed: ${error.message}`);
    });
};
```

## Drag-and-Drop

Компонент поддерживает drag-and-drop:

1. Перетащите файлы на drop zone
2. Drop zone подсвечивается при наведении
3. Файлы автоматически валидируются после drop

Визуальная обратная связь:
- Обычное состояние: серая рамка
- Наведение: белая рамка
- Перетаскивание: розовая рамка (цвет primary)

## Accessibility

- ✅ `role="dialog"` и `aria-modal="true"`
- ✅ `aria-labelledby` для связи с заголовком
- ✅ Focus trap - Tab и Shift+Tab работают внутри модального окна
- ✅ ESC для закрытия
- ✅ `aria-label` для кнопки закрытия
- ✅ `role="alert"` для сообщений об ошибках
- ✅ Keyboard navigation (Enter/Space для открытия file picker)
- ✅ Поддержка `prefers-reduced-motion`

## Стилизация

Вы можете кастомизировать компонент через:

1. **Props className**:
```tsx
<UploadModal className="custom-upload" {...props}>
```

2. **CSS переопределение**:
```css
.upload-modal {
  max-width: 500px; /* Изменить ширину */
}

.upload-drop-zone {
  min-height: 300px; /* Изменить высоту drop zone */
}
```

## Responsive поведение

- **Mobile (< 480px)**:
  - Модальное окно занимает почти всю ширину экрана
  - Кнопки в footer располагаются вертикально
  - Drop zone имеет уменьшенную высоту

- **Desktop (>= 480px)**:
  - Модальное окно ограничено 400px шириной
  - Кнопки в footer располагаются горизонтально
  - Drop zone имеет увеличенную высоту

## Дизайн из Figma

Основано на компонентах UPLOAD (nodeId: 735:1422 и 736:1467):

### Цвета:
- Background modal: #262626 → `--color-surface`
- Background input: #171717 → `--color-background`
- Text: #ffffff → `--color-text`
- Secondary text: #8a8a8a → `--color-text-secondary`
- Primary button: #ee449f → `--color-primary`
- Border: #8a8a8a → `--color-border`

### Типографика:
- Заголовок: 32px, Bold (Manrope)
- Подзаголовок: 16px, Regular (Manrope)
- Кнопка: 16px, ExtraBold, uppercase (Manrope)

### Размеры:
- Modal width: 90%, max 400px
- Border radius: 16px (modal), 10px (buttons)
- Button height: 44px
- Input height: 45px

## Примеры использования

Смотрите `UploadModal.example.tsx` для полных примеров использования.

## Часто задаваемые вопросы

### Как ограничить количество файлов?

```tsx
const handleUpload = (files: File[]) => {
  if (files.length > 5) {
    alert('Maximum 5 files allowed');
    return;
  }
  // Продолжить загрузку
};
```

### Как показать предпросмотр изображений?

```tsx
const [previews, setPreviews] = useState<string[]>([]);

const handleUpload = (files: File[]) => {
  const newPreviews = files.map((file) => URL.createObjectURL(file));
  setPreviews(newPreviews);
  // Загрузка файлов
};

// Не забудьте очистить URLs
useEffect(() => {
  return () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
  };
}, [previews]);
```

### Как добавить прогресс загрузки?

Вы можете использовать состояние для отслеживания прогресса:

```tsx
const [uploadProgress, setUploadProgress] = useState(0);

const handleUpload = async (files: File[]) => {
  for (let i = 0; i < files.length; i++) {
    await uploadFile(files[i]);
    setUploadProgress(((i + 1) / files.length) * 100);
  }
};
```
