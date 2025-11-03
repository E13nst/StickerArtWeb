# Сменяющиеся превью стикеров

## Обзор

Реализована функциональность отображения 3 сменяющихся превью стикеров в карточках стикерпаков.

## Компоненты

### PackCard
- **Автоматическая смена**: стикеры меняются каждые 2.3 секунды
- **Ускоренная смена при наведении**: каждые 618мс при hover
- **Плавные переходы**: opacity и scale анимации
- **Индикаторы**: счетчик стикеров и прогресс-бар

### useStickerRotation
Хук для управления ротацией стикеров:
```typescript
const { currentIndex, goToNext, goToPrevious, goToIndex } = useStickerRotation({
  stickersCount: 3,
  autoRotateInterval: 2333,
  hoverRotateInterval: 618,
  isHovered: false,
  isVisible: true
});
```

### StickerProgressIndicator
Компонент индикатора прогресса:
- Точки показывают текущий стикер
- Позиционируется внизу карточки
- Скрывается при одном стикере

## Адаптер данных

### galleryAdapter.ts
- Выбирает 3 случайных стикера из пака
- Кэширует результаты для производительности
- Возвращает массив `previewStickers`

## Особенности

### Производительность
- ✅ Ленивая загрузка изображений
- ✅ Кэширование адаптированных данных
- ✅ Оптимизированные анимации
- ✅ Остановка анимации при скрытии карточки

### UX
- ✅ Плавные переходы между стикерами
- ✅ Ускоренная смена при наведении
- ✅ Визуальные индикаторы прогресса
- ✅ Поддержка анимированных стикеров

### Адаптивность
- ✅ Работает с любым количеством стикеров (1-3)
- ✅ Graceful fallback для пустых паков
- ✅ Поддержка мобильных устройств

## Использование

```typescript
// В GalleryPage.tsx
const galleryPacks = adaptStickerSetsToGalleryPacks(stickerSets);

// В GalleryGrid.tsx
<PackCard
  pack={pack}
  isHighPriority={index < 6}
  onClick={handlePackClick}
/>
```

## Настройки

Можно настроить интервалы смены стикеров:

```typescript
const { currentIndex } = useStickerRotation({
  stickersCount: pack.previewStickers.length,
  autoRotateInterval: 3000, // 3 секунды (изменено)
  hoverRotateInterval: 800, // 800мс при hover
  isHovered,
  isVisible: isNear
});
```

## Лайки

### LikeButton компонент
- **Состояние**: отслеживание лайка и количества
- **Анимация**: масштабирование при клике
- **Размеры**: small, medium, large
- **Счетчик**: отображение количества лайков

### Store для лайков
```typescript
const { getLikeState, toggleLike, isLiked, getLikesCount } = useLikesStore();

// Получить состояние лайка
const likeState = getLikeState(packId);

// Переключить лайк
toggleLike(packId);

// Проверить статус
const isLiked = isLiked(packId);
const count = getLikesCount(packId);
```
