# Система лайков для стикерпаков

## Обзор

Реализована система лайков с анимированными кнопками, состоянием и персистентным хранением.

## Компоненты

### LikeButton
- **Анимация**: масштабирование при клике
- **Состояние**: отслеживание лайка и количества
- **Размеры**: small (24px), medium (32px), large (40px)
- **Счетчик**: отображение количества лайков для больших размеров

### useLikesStore
- **Персистентность**: сохранение в localStorage
- **Состояние**: isLiked, likesCount для каждого пака
- **Методы**: toggleLike, setLike, getLikeState

## Использование

### Базовое использование
```typescript
<LikeButton
  packId={pack.id}
  size="medium"
  onLike={(packId, isLiked) => {
    console.log(`Лайк ${isLiked ? 'добавлен' : 'убран'}`);
  }}
/>
```

### С состоянием из store
```typescript
const { getLikeState, toggleLike } = useLikesStore();
const likeState = getLikeState(pack.id);

<LikeButton
  packId={pack.id}
  initialLiked={likeState.isLiked}
  initialLikesCount={likeState.likesCount}
  onLike={toggleLike}
/>
```

## API Store

### Методы
```typescript
// Переключить лайк
toggleLike(packId: string): void

// Установить лайк
setLike(packId: string, isLiked: boolean, likesCount?: number): void

// Получить состояние
getLikeState(packId: string): LikeState

// Проверить статус
isLiked(packId: string): boolean
getLikesCount(packId: string): number
```

### Интерфейс LikeState
```typescript
interface LikeState {
  packId: string;
  isLiked: boolean;
  likesCount: number;
}
```

## Особенности

### Анимации
- ✅ **Масштабирование** - scale(1.2) при клике
- ✅ **Плавные переходы** - 0.2s ease
- ✅ **Визуальная обратная связь** - изменение цвета и размера

### Персистентность
- ✅ **localStorage** - автоматическое сохранение
- ✅ **Восстановление** - при перезагрузке страницы
- ✅ **Синхронизация** - между компонентами

### UX
- ✅ **Интуитивность** - понятные иконки (❤️/🤍)
- ✅ **Обратная связь** - анимации и tooltips
- ✅ **Доступность** - keyboard navigation
- ✅ **Производительность** - мемоизация и оптимизация

## Стилизация

### Размеры
```typescript
const sizeStyles = {
  small: { width: '24px', height: '24px', fontSize: '12px' },
  medium: { width: '32px', height: '32px', fontSize: '16px' },
  large: { width: '40px', height: '40px', fontSize: '20px' }
};
```

### Цвета
- **Лайкнуто**: `#ff6b6b` (красный)
- **Не лайкнуто**: `#ffffff` (белый)
- **Фон**: `var(--tg-theme-overlay-color)`
- **Граница**: `rgba(255, 255, 255, 0.2)`

## Интеграция с API

### Планируемые функции
```typescript
// API вызовы для синхронизации с сервером
const syncLikeWithServer = async (packId: string, isLiked: boolean) => {
  await apiClient.toggleLike(packId, isLiked);
};

// Загрузка лайков с сервера
const loadLikesFromServer = async (packIds: string[]) => {
  const likes = await apiClient.getLikes(packIds);
  likes.forEach(like => setLike(like.packId, like.isLiked, like.count));
};
```
