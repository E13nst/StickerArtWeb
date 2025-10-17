# 🎨 Руководство по Telegram Mini App UI

## ✅ Что уже сделано

### 1. Установлены зависимости
- `@telegram-apps/telegram-ui` - официальная UI библиотека Telegram

### 2. Базовые стили (index.css)
- ✅ Telegram CSS переменные
- ✅ Safe areas для iOS
- ✅ Адаптивная типографика
- ✅ Telegram-style анимации
- ✅ Smooth scrolling
- ✅ Loading skeletons

### 3. Компоненты
- ✅ `TelegramLayout` - базовый layout с BackButton
- ✅ `TelegramStickerCard` - карточка стикерсета в стиле Telegram

### 4. Интеграции
- ✅ Haptic Feedback
- ✅ BackButton API
- ✅ Адаптивная тема (светлая/темная)

## 🎯 Best Practices для Telegram Mini Apps

### 1. **Layout и Navigation**
```tsx
// ✅ Правильно: используем TelegramLayout
<TelegramLayout title="Галерея" showBackButton={true} onBackClick={goBack}>
  <Content />
</TelegramLayout>

// ❌ Неправильно: свой header
<Header>...</Header>
```

### 2. **Haptic Feedback**
```tsx
// ✅ Используйте haptic для всех кликов
const handleClick = () => {
  tg.HapticFeedback.impactOccurred('light');
  // ваш код
};

// Типы haptic:
// - 'light' - легкое нажатие
// - 'medium' - среднее
// - 'heavy' - сильное
// - 'rigid' - жесткое
// - 'soft' - мягкое
```

### 3. **Spacing (отступы)**
```css
/* Используйте CSS переменные Telegram */
padding: var(--tg-spacing-4); /* 16px */
margin-bottom: var(--tg-spacing-3); /* 12px */

/* Доступные размеры:
--tg-spacing-1: 4px
--tg-spacing-2: 8px
--tg-spacing-3: 12px
--tg-spacing-4: 16px
--tg-spacing-5: 20px
--tg-spacing-6: 24px
*/
```

### 4. **Цвета**
```css
/* ✅ Используйте Telegram переменные */
background-color: var(--tg-theme-bg-color);
color: var(--tg-theme-text-color);

/* ❌ Не используйте фиксированные цвета */
background-color: #ffffff; /* плохо */
```

### 5. **Typography**
```css
/* Размеры шрифтов */
font-size: var(--tg-font-size-m); /* 16px */

/* Доступные размеры:
--tg-font-size-xs: 12px
--tg-font-size-s: 14px
--tg-font-size-m: 16px (основной)
--tg-font-size-l: 18px
--tg-font-size-xl: 20px
--tg-font-size-xxl: 24px
*/
```

### 6. **Border Radius**
```css
/* Telegram радиусы */
border-radius: var(--tg-radius-m); /* 12px */

/* Доступные радиусы:
--tg-radius-s: 8px
--tg-radius-m: 12px
--tg-radius-l: 16px
*/
```

### 7. **MainButton (главная кнопка)**
```tsx
useEffect(() => {
  if (!tg) return;
  
  // Настраиваем MainButton
  tg.MainButton.setText('Добавить стикеры');
  tg.MainButton.show();
  tg.MainButton.onClick(handleAdd);
  
  return () => {
    tg.MainButton.hide();
    tg.MainButton.offClick(handleAdd);
  };
}, [tg]);
```

### 8. **Анимации**
```tsx
// ✅ Используйте fade-in для появления
<div className="fade-in">
  <Content />
</div>

// ✅ Scale на клик (через :active)
<div className="tg-ripple" onClick={handleClick}>
  <Button />
</div>
```

### 9. **Оптимизация прокрутки**
```tsx
// ✅ Добавьте smooth-scroll
<div className="smooth-scroll" style={{ overflowY: 'auto' }}>
  <List />
</div>
```

### 10. **Safe Areas (iOS)**
```css
/* Автоматически учитывается в TelegramLayout */
@supports (padding: max(0px)) {
  .content {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}
```

## 📦 Использование компонентов

### TelegramStickerCard
```tsx
import { TelegramStickerCard } from './components/TelegramStickerCard';

<TelegramStickerCard
  title="Название паксета"
  description="Описание"
  stickerCount={24}
  previewStickers={[
    { id: '1', thumbnailUrl: '...', emoji: '😀', isAnimated: true },
    { id: '2', thumbnailUrl: '...', emoji: '🎨' },
    { id: '3', thumbnailUrl: '...', emoji: '🚀' },
    { id: '4', thumbnailUrl: '...', emoji: '💡' },
  ]}
  onClick={() => navigate('/stickerset/123')}
/>
```

### TelegramLayout
```tsx
import { TelegramLayout } from './components/TelegramLayout';

<TelegramLayout
  title="Моя галерея"
  showBackButton={true}
  onBackClick={() => navigate(-1)}
>
  <YourContent />
</TelegramLayout>
```

## 🔄 Следующие шаги

### Высокий приоритет
1. ⬜ Переработать GalleryPage с TelegramLayout
2. ⬜ Заменить старые Card на TelegramStickerCard
3. ⬜ Добавить haptic feedback на все кнопки
4. ⬜ Использовать MainButton для основных действий

### Средний приоритет
5. ⬜ Создать TelegramButton компонент
6. ⬜ Создать TelegramList компонент
7. ⬜ Переработать навигацию (убрать BottomNav, использовать BackButton)
8. ⬜ Добавить loading states со skeleton

### Низкий приоритет
9. ⬜ Добавить pull-to-refresh
10. ⬜ Оптимизировать анимации
11. ⬜ Добавить error boundaries в стиле Telegram

## 🎨 Дизайн принципы

1. **Минимализм** - меньше элементов, больше пространства
2. **Нативность** - должно выглядеть как часть Telegram
3. **Responsive** - работает на всех устройствах
4. **Быстрота** - instant feedback, плавные анимации
5. **Accessibility** - поддержка темной темы, читаемость

## 📱 Тестирование

### В браузере (dev mode)
```bash
npm run dev
# Откройте http://localhost:3000/miniapp/
```

### В Telegram
1. Создайте бота через @BotFather
2. Настройте Mini App URL
3. Откройте в Telegram для тестирования

## 🔗 Полезные ссылки

- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [@telegram-apps/telegram-ui](https://github.com/Telegram-Mini-Apps/telegram-ui)
- [Design Guidelines](https://core.telegram.org/bots/webapps#design-guidelines)

