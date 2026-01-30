# Migration Guide: Material-UI → Custom Design System

Гайд по миграции с Material-UI на кастомную дизайн-систему StickerArtWeb.

## Оглавление

1. [Введение](#введение)
2. [Что изменилось](#что-изменилось)
3. [Маппинг компонентов](#маппинг-компонентов)
4. [Примеры миграции](#примеры-миграции)
5. [Breaking Changes](#breaking-changes)
6. [FAQ и Troubleshooting](#faq-и-troubleshooting)
7. [Контрольный чек-лист](#контрольный-чек-лист)

---

## Введение

### Почему мигрировали с MUI?

Проект StickerArtWeb мигрировал с Material-UI на кастомную дизайн-систему по следующим причинам:

1. **Размер bundle** - MUI + Emotion добавляли ~300KB gzipped
2. **Конфликты с Telegram темами** - MUI темы конфликтовали с Telegram Mini App темами
3. **Полный контроль** - Кастомная система дает полный контроль над стилями
4. **Производительность** - Меньше JS overhead, более легкие компоненты
5. **Кастомизация** - Упрощенная кастомизация под дизайн из Figma

### Статус миграции

✅ **Завершено** - Все импорты MUI удалены из проекта (30 января 2026)

- **Файлов обработано**: 40+
- **Созданных компонентов**: 5 новых UI компонентов
- **Зависимостей удалено**: 4 пакета (@mui/material, @mui/icons-material, @emotion/react, @emotion/styled)

---

## Что изменилось

### Удаленные зависимости

```json
// package.json - УДАЛЕНО
{
  "@emotion/react": "^11.11.1",
  "@emotion/styled": "^11.11.0",
  "@mui/icons-material": "^5.15.0",
  "@mui/material": "^5.15.0"
}
```

### Новые компоненты

Созданы кастомные компоненты в `miniapp/src/components/ui/`:

- ✅ `Text` - Замена `Typography`
- ✅ `Button` - Замена `Button`
- ✅ `Card` / `CardContent` - Замена `Card` / `CardContent`
- ✅ `Avatar` - Замена `Avatar`
- ✅ `Chip` - Замена `Chip`
- ✅ `Icons` - Замена `@mui/icons-material/*`

### Новые стили

- ✅ `design-tokens.json` - JSON с токенами дизайна
- ✅ `tokens.css` - CSS-переменные для токенов
- ✅ `figma-tokens.css` - Токены из Figma
- ✅ `common.css` - Утилитарные классы
- ✅ `typography.css` - Типографические стили

---

## Маппинг компонентов

### Основные компоненты

| MUI Компонент | Замена | Файл | Примечания |
|---------------|--------|------|------------|
| `Box` | `div` | - | Используйте нативный `div` с CSS классами |
| `Typography` | `Text` | `components/ui/Text.tsx` | Полная замена с вариантами |
| `Button` | `Button` | `components/ui/Button.tsx` | Аналогичный API |
| `Card` | `Card` | `components/ui/Card.tsx` | Упрощенный API |
| `CardContent` | `CardContent` | `components/ui/Card.tsx` | Отдельный компонент |
| `Avatar` | `Avatar` | `components/ui/Avatar.tsx` | Упрощенный API |
| `Chip` | `Chip` | `components/ui/Chip.tsx` | Аналогичный API |
| `IconButton` | `button` | - | Используйте нативный `button` |
| `CircularProgress` | CSS спиннер | - | Используйте CSS анимацию или `Button` с `loading` |
| `Dialog` | `BottomSheet` | `components/ui/BottomSheet.tsx` | Модальное окно снизу |
| `TextField` | `input` | - | Используйте нативный `input` |
| `Alert` | `div[role="alert"]` | - | Используйте нативный элемент |

### Иконки

| MUI Icon | Замена | Файл |
|----------|--------|------|
| `@mui/icons-material/Close` | `CloseIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Search` | `SearchIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Tune` | `TuneIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/KeyboardArrowDown` | `KeyboardArrowDownIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/CheckCircle` | `CheckCircleIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/ArrowBack` | `ArrowBackIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/MoreVert` | `MoreVertIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Share` | `ShareIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Favorite` | `FavoriteIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Delete` | `DeleteIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Edit` | `EditIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Block` | `BlockIcon` | `components/ui/Icons.tsx` |
| `@mui/icons-material/Visibility` | `VisibilityIcon` | `components/ui/Icons.tsx` |

### Стилизация

| MUI подход | Замена | Пример |
|------------|--------|--------|
| `sx` prop | `className` + CSS | `<div className="my-class">` |
| `styled()` | CSS модули или классы | `.my-component { }` |
| `theme` | CSS-переменные | `var(--color-primary)` |
| `makeStyles` | CSS файлы | `Component.css` |

---

## Примеры миграции

### Box → div

**До (MUI)**:
```tsx
import { Box } from '@mui/material';

<Box sx={{ p: 2, bgcolor: 'primary.main' }}>
  Content
</Box>
```

**После (Custom)**:
```tsx
<div className="p-1" style={{ backgroundColor: 'var(--color-primary)' }}>
  Content
</div>

// Или с CSS классом
<div className="my-component">
  Content
</div>
```

```css
/* my-component.css */
.my-component {
  padding: var(--spacing-md);
  background-color: var(--color-primary);
}
```

---

### Typography → Text

**До (MUI)**:
```tsx
import { Typography } from '@mui/material';

<Typography variant="h1" color="primary">
  Заголовок
</Typography>

<Typography variant="body1" color="text.secondary">
  Текст
</Typography>
```

**После (Custom)**:
```tsx
import { Text } from '@/components/ui';

<Text variant="h1" color="primary">
  Заголовок
</Text>

<Text variant="body" color="hint">
  Текст
</Text>
```

---

### Button

**До (MUI)**:
```tsx
import { Button } from '@mui/material';

<Button variant="contained" color="primary" size="large">
  Click me
</Button>

<Button variant="outlined" disabled>
  Disabled
</Button>

<Button startIcon={<Icon />}>
  With icon
</Button>
```

**После (Custom)**:
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="large">
  Click me
</Button>

<Button variant="outline" disabled>
  Disabled
</Button>

<Button icon={<Icon />}>
  With icon
</Button>
```

---

### Card

**До (MUI)**:
```tsx
import { Card, CardContent } from '@mui/material';

<Card>
  <CardContent>
    <Typography variant="h5">Title</Typography>
    <Typography variant="body2">Content</Typography>
  </CardContent>
</Card>
```

**После (Custom)**:
```tsx
import { Card, CardContent } from '@/components/ui';
import { Text } from '@/components/ui';

<Card>
  <CardContent>
    <Text variant="h3">Title</Text>
    <Text variant="bodySmall">Content</Text>
  </CardContent>
</Card>

// Или используйте утилитарный класс
<div className="card-base">
  <div className="card-content-base">
    <Text variant="h3">Title</Text>
    <Text variant="bodySmall">Content</Text>
  </div>
</div>
```

---

### Avatar

**До (MUI)**:
```tsx
import { Avatar } from '@mui/material';

<Avatar src="/avatar.jpg" alt="User" />
<Avatar>JD</Avatar>
<Avatar sx={{ width: 56, height: 56 }}>JD</Avatar>
```

**После (Custom)**:
```tsx
import { Avatar } from '@/components/ui';

<Avatar src="/avatar.jpg" alt="User" />
<Avatar>JD</Avatar>
<Avatar size={56}>JD</Avatar>
```

---

### Chip

**До (MUI)**:
```tsx
import { Chip } from '@mui/material';

<Chip label="React" />
<Chip label="TypeScript" variant="outlined" size="small" />
<Chip label="Clickable" onClick={handleClick} />
```

**После (Custom)**:
```tsx
import { Chip } from '@/components/ui';

<Chip label="React" />
<Chip label="TypeScript" variant="outlined" size="small" />
<Chip label="Clickable" onClick={handleClick} />
```

---

### IconButton → button

**До (MUI)**:
```tsx
import { IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

<IconButton onClick={handleClose}>
  <CloseIcon />
</IconButton>
```

**После (Custom)**:
```tsx
import { CloseIcon } from '@/components/ui/Icons';

<button 
  onClick={handleClose}
  className="icon-button"
  aria-label="Close"
>
  <CloseIcon />
</button>
```

```css
/* icon-button.css */
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--border-radius-md);
  transition: background-color 0.2s;
}

.icon-button:hover {
  background-color: var(--color-overlay-light);
}
```

---

### Dialog → BottomSheet

**До (MUI)**:
```tsx
import { Dialog, DialogTitle, DialogContent } from '@mui/material';

<Dialog open={isOpen} onClose={handleClose}>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>
    Content
  </DialogContent>
</Dialog>
```

**После (Custom)**:
```tsx
import { BottomSheet } from '@/components/ui';

<BottomSheet
  isOpen={isOpen}
  onClose={handleClose}
  title="Title"
>
  Content
</BottomSheet>
```

---

### TextField → input

**До (MUI)**:
```tsx
import { TextField } from '@mui/material';

<TextField
  label="Email"
  variant="outlined"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
```

**После (Custom)**:
```tsx
<div className="input-wrapper">
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className="input"
  />
</div>
```

```css
/* input.css */
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background-color: var(--color-surface);
  color: var(--color-text);
  font-family: var(--font-family-base);
  font-size: var(--typography-body-font-size);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary);
}
```

---

### CircularProgress → Loading Spinner

**До (MUI)**:
```tsx
import { CircularProgress } from '@mui/material';

<CircularProgress />
<CircularProgress size={40} />
```

**После (Custom)**:
```tsx
// Вариант 1: Используйте Button с loading
<Button loading={isLoading}>Submit</Button>

// Вариант 2: CSS спиннер
<div className="spinner" aria-label="Loading"></div>
```

```css
/* spinner.css */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

### sx prop → className

**До (MUI)**:
```tsx
<Box
  sx={{
    p: 2,
    bgcolor: 'primary.main',
    borderRadius: 2,
    display: 'flex',
    gap: 1,
  }}
>
  Content
</Box>
```

**После (Custom)**:
```tsx
<div className="my-component">
  Content
</div>
```

```css
/* my-component.css */
.my-component {
  padding: var(--spacing-md);
  background-color: var(--color-primary);
  border-radius: var(--border-radius-md);
  display: flex;
  gap: var(--spacing-sm);
}
```

---

## Breaking Changes

### 1. Импорты

**До**:
```tsx
import { Box, Typography, Button } from '@mui/material';
```

**После**:
```tsx
import { Text, Button } from '@/components/ui';
// Box → div (нативный)
```

### 2. Typography варианты

MUI варианты не совпадают с нашими:

| MUI | Custom | Примечание |
|-----|--------|------------|
| `h1` | `h1` | ✅ Совпадает |
| `h2` | `h2` | ✅ Совпадает |
| `h3` | `h3` | ✅ Совпадает |
| `h4` | `h4` | ✅ Совпадает |
| `h5` | `h3` или `h4` | Используйте h3/h4 |
| `h6` | `h4` | Используйте h4 |
| `body1` | `body` | ✅ Совпадает |
| `body2` | `bodySmall` | ⚠️ Изменилось |
| `caption` | `caption` | ✅ Совпадает |
| `button` | `label` | ⚠️ Изменилось |

### 3. Button варианты

| MUI | Custom | Примечание |
|-----|--------|------------|
| `contained` | `primary` | ⚠️ Изменилось |
| `outlined` | `outline` | ⚠️ Изменилось |
| `text` | `ghost` | ⚠️ Изменилось |

### 4. Цвета

MUI использует `theme.palette.*`, мы используем CSS-переменные:

| MUI | Custom CSS | Пример |
|-----|------------|--------|
| `theme.palette.primary.main` | `var(--color-primary)` | `#ee449f` |
| `theme.palette.secondary.main` | `var(--color-secondary)` | `#007aff` |
| `theme.palette.text.primary` | `var(--color-text)` | `#ffffff` |
| `theme.palette.text.secondary` | `var(--color-text-secondary)` | `#8a8a8a` |
| `theme.palette.background.paper` | `var(--color-surface)` | `#262626` |

### 5. Spacing

MUI использует `theme.spacing()`, мы используем токены:

| MUI | Custom | Значение |
|-----|--------|----------|
| `theme.spacing(1)` | `var(--spacing-xs)` | `4px` |
| `theme.spacing(2)` | `var(--spacing-sm)` | `8px` |
| `theme.spacing(3)` | `var(--spacing-md)` | `16px` |
| `theme.spacing(4)` | `var(--spacing-lg)` | `24px` |

### 6. sx prop

`sx` prop больше не поддерживается. Используйте:
- `className` с CSS классами
- `style` для inline стилей
- CSS модули для сложных стилей

---

## FAQ и Troubleshooting

### Q: Как заменить сложный компонент MUI?

**A**: Создайте кастомный компонент на основе нативных HTML элементов и CSS. Используйте существующие UI компоненты как основу.

### Q: Где найти замену для [компонент MUI]?

**A**: 
1. Проверьте `components/ui/` - там могут быть готовые компоненты
2. Используйте нативные HTML элементы (`div`, `button`, `input`, etc.)
3. Создайте свой компонент, если нужна сложная логика

### Q: Как стилизовать компонент без sx prop?

**A**: 
1. Создайте CSS файл рядом с компонентом
2. Используйте CSS-переменные для цветов и spacing
3. Импортируйте CSS в компонент

```tsx
// Component.tsx
import './Component.css';

export const Component = () => {
  return <div className="component">Content</div>;
};
```

```css
/* Component.css */
.component {
  padding: var(--spacing-md);
  background-color: var(--color-surface);
  border-radius: var(--border-radius-lg);
}
```

### Q: Как использовать темы без MUI theme?

**A**: Используйте CSS-переменные. Они автоматически адаптируются под Telegram темы:

```css
.my-component {
  background-color: var(--color-background);
  color: var(--color-text);
}
```

### Q: Где взять иконки?

**A**: Используйте компоненты из `components/ui/Icons.tsx` или добавьте свои SVG иконки.

### Q: Как сделать responsive дизайн?

**A**: Используйте CSS media queries:

```css
.my-component {
  padding: var(--spacing-md);
}

@media (max-width: 768px) {
  .my-component {
    padding: var(--spacing-sm);
  }
}
```

### Q: Как использовать анимации?

**A**: Используйте CSS animations или библиотеку `framer-motion` (уже используется в `SwipeCardStack`):

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in;
}
```

### Q: Что делать с Dialog, Drawer, Popover?

**A**: 
- **Dialog** → Используйте `BottomSheet`
- **Drawer** → Создайте кастомный компонент или используйте `BottomSheet`
- **Popover** → Создайте кастомный компонент с позиционированием

### Q: Как тестировать компоненты?

**A**: Используйте стандартные инструменты тестирования (Jest, React Testing Library). Компоненты не зависят от MUI, поэтому тестирование упрощается.

---

## Контрольный чек-лист

Используйте этот чек-лист при миграции компонентов:

### Подготовка

- [ ] Удалить импорты MUI из файла
- [ ] Определить, какие компоненты MUI используются
- [ ] Найти замены в `components/ui/` или создать новые

### Замена компонентов

- [ ] `Box` → `div` с CSS классами
- [ ] `Typography` → `Text` компонент
- [ ] `Button` → `Button` компонент
- [ ] `Card` → `Card` компонент
- [ ] `Avatar` → `Avatar` компонент
- [ ] `Chip` → `Chip` компонент
- [ ] `IconButton` → `button` элемент
- [ ] `Dialog` → `BottomSheet` компонент
- [ ] `TextField` → `input` элемент
- [ ] `CircularProgress` → CSS спиннер или `Button` с `loading`

### Замена иконок

- [ ] Заменить импорты `@mui/icons-material/*` на `components/ui/Icons`
- [ ] Проверить, что все иконки доступны

### Стилизация

- [ ] Удалить `sx` props
- [ ] Создать CSS файл для компонента
- [ ] Заменить `theme.*` на CSS-переменные
- [ ] Заменить `theme.spacing()` на токены spacing
- [ ] Использовать утилитарные классы из `common.css` где возможно

### Тестирование

- [ ] Проверить визуальное отображение
- [ ] Проверить интерактивность (клики, hover, focus)
- [ ] Проверить адаптивность на разных размерах экрана
- [ ] Проверить работу в Telegram Mini App
- [ ] Проверить accessibility (клавиатурная навигация, screen readers)

### Финальная проверка

- [ ] Нет импортов `@mui/*` в файле
- [ ] Нет использования `sx` prop
- [ ] Нет использования `theme.*`
- [ ] Все стили используют CSS-переменные
- [ ] Компонент работает корректно
- [ ] Код соответствует стилю проекта

---

## Полезные ссылки

- [Design System Documentation](./design-system.md) - Полная документация дизайн-системы
- [Figma Mapping](./figma-mapping.md) - Маппинг компонентов Figma → React
- [MUI Removal Report](./mui-removal-report.md) - Отчет о удалении MUI

---

*Последнее обновление: 2026-01-30*
