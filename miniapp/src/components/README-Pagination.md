# Пагинация с автоматической загрузкой

## Обзор

Реализована система пагинации с автоматической загрузкой следующей страницы при достижении конца списка.

## Компоненты

### SimpleGallery
- **Infinite Scroll**: автоматическая загрузка при приближении к концу
- **Intersection Observer**: отслеживание видимости триггера
- **Индикатор загрузки**: спиннер с анимацией
- **Предзагрузка**: критических изображений для первых 6 паков

### GalleryPage
- **Управление состоянием**: currentPage, totalPages, totalElements
- **Загрузка данных**: fetchStickerSets с поддержкой isLoadMore
- **Добавление данных**: addStickerSets для накопления результатов

## API Integration

### Store (useStickerStore)
```typescript
interface StickerState {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  setPagination: (page: number, totalPages: number, totalElements: number) => void;
  addStickerSets: (newStickerSets: StickerSetResponse[]) => void;
}
```

### Загрузка данных
```typescript
const fetchStickerSets = async (page: number = 0, isLoadMore: boolean = false) => {
  if (isLoadMore) {
    addStickerSets(response.content || []);
  } else {
    setStickerSets(response.content || []);
  }
  setPagination(response.number, response.totalPages, response.totalElements);
};
```

## Особенности

### Производительность
- ✅ **Intersection Observer** - эффективное отслеживание скролла
- ✅ **Предзагрузка** - критических ресурсов
- ✅ **Кэширование** - адаптированных данных
- ✅ **Ленивая загрузка** - изображений

### UX
- ✅ **Плавная загрузка** - без блокировки интерфейса
- ✅ **Визуальные индикаторы** - спиннер загрузки
- ✅ **Автоматическая загрузка** - при достижении конца
- ✅ **Обработка ошибок** - graceful fallback

### Адаптивность
- ✅ **Мобильные устройства** - touch-friendly
- ✅ **Различные размеры экрана** - responsive grid
- ✅ **Медленные соединения** - оптимизированная загрузка

## Использование

```typescript
// В GalleryPage.tsx
<SimpleGallery
  packs={galleryPacks}
  onPackClick={handleViewStickerSet}
  hasNextPage={currentPage < totalPages - 1}
  isLoadingMore={uiState.isLoadingMore}
  onLoadMore={loadMoreStickerSets}
  enablePreloading={true}
/>
```

## Настройки

### Intersection Observer
```typescript
{
  rootMargin: '100px',    // Загрузка за 100px до конца
  threshold: 0.1          // 10% видимости триггера
}
```

### Предзагрузка
```typescript
preloadCriticalImages(packs, 6)  // Первые 6 паков
```

## Логика работы

1. **Инициализация**: загрузка первой страницы
2. **Скролл**: отслеживание приближения к концу
3. **Триггер**: срабатывание Intersection Observer
4. **Загрузка**: запрос следующей страницы
5. **Обновление**: добавление новых данных к существующим
6. **Индикатор**: показ спиннера во время загрузки

## Обработка ошибок

- **Сетевые ошибки**: graceful fallback с сохранением существующих данных
- **Пустые результаты**: корректное отображение состояния
- **Медленные запросы**: индикаторы загрузки
- **Повторные запросы**: защита от дублирования

