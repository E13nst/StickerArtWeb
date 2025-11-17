# Сущности, связанные с отображением в SimpleGallery

## Основные компоненты

### 1. **SimpleGallery** (`miniapp/src/components/SimpleGallery.tsx`)
   - Главный компонент галереи
   - Интерфейсы:
     - `Pack` - структура данных пака
     - `SimpleGalleryProps` - пропсы компонента
   - Состояния отображения:
     - `visibleCount` - количество видимых элементов
     - `showSkeleton` - флаг показа skeleton loader
     - `likeAnimations` - Map анимаций лайков
     - `hideControls` - скрытие элементов управления
     - `floatAmplitudes` - амплитуды анимации колонок

### 2. **PackCard** (`miniapp/src/components/PackCard.tsx`)
   - Компонент карточки пака
   - Интерфейсы:
     - `Pack` - структура данных пака
     - `PackCardProps` - пропсы карточки
   - **Что такое пропсы (props)?**
     - Пропсы (props) — это параметры, которые передаются в React-компонент от родительского компонента
     - Это способ передачи данных "сверху вниз" (от родителя к ребенку)
     - В TypeScript пропсы описываются через интерфейс, что обеспечивает типобезопасность
     - Пример `PackCardProps`:
       ```typescript
       interface PackCardProps {
         pack: Pack;                    // Обязательный: данные пака
         isFirstRow?: boolean;           // Опциональный: в первой строке?
         isHighPriority?: boolean;       // Опциональный: высокий приоритет загрузки?
         onClick?: (packId: string) => void; // Опциональный: обработчик клика
       }
       ```
     - Использование: `<PackCard pack={myPack} isFirstRow={true} onClick={handleClick} />`
   - Состояния отображения:
     - `isHovered` - состояние наведения
     - `isFirstStickerReady` - готовность первого стикера
   - Элементы отображения:
     - Skeleton loader для первого стикера
     - Ротация стикеров (через `useStickerRotation`)
     - Заголовок пака
     - Интерактивный счетчик лайков

### 3. **VirtualizedGallery** (`miniapp/src/components/VirtualizedGallery.tsx`)
   - Виртуализированная версия галереи (для больших списков)
   - Интерфейсы:
     - `Pack` - структура данных пака
     - `VirtualizedGalleryProps` - пропсы виртуализированной галереи
   - Состояния отображения:
     - `scrollTop` - позиция скролла
     - `containerWidth` - ширина контейнера
     - `measuredHeight` - измеренная высота
   - Вычисляемые значения:
     - `visibleRange` - диапазон видимых элементов (startIndex, endIndex, itemsPerRow, totalRows)

### 4. **AnimatedPackCard** (`miniapp/src/components/AnimatedPackCard.tsx`)
   - Анимированная версия карточки пака (используется в VirtualizedGallery)
   - Интерфейсы:
     - `AnimatedPackCardProps` - пропсы анимированной карточки

### 5. **AnimatedSticker** (`miniapp/src/components/AnimatedSticker.tsx`)
   - Компонент для отображения анимированных стикеров (Lottie)
   - Интерфейсы:
     - `AnimatedStickerProps` - пропсы анимированного стикера

### 6. **InteractiveLikeCount** (`miniapp/src/components/InteractiveLikeCount.tsx`)
   - Интерактивный счетчик лайков на карточке
   - Интерфейсы:
     - `InteractiveLikeCountProps` - пропсы счетчика лайков

### 7. **LoadingSpinner** (`miniapp/src/components/LoadingSpinner.tsx`)
   - Спиннер загрузки
   - Используется для `isRefreshing` состояния

## CSS классы и стили

### Основные классы:
- `.simpleGallery` - основной контейнер галереи
- `.simpleGallery--pageScroll` - режим скролла страницы
- `.simpleGallery--innerScroll` - режим внутреннего скролла
- `.gallery-scroll` - стили для скролла
- `.gallery-items` - контейнер элементов галереи
- `.gallery-overlay` - оверлей для элементов управления
- `.gallery-overlay.hidden` - скрытый оверлей
- `.gallery-column-float-1` - левая колонка с анимацией
- `.gallery-column-float-2` - правая колонка с анимацией
- `.pack-card` - стили карточки пака
- `.pack-card-animated-sticker` - анимированный стикер в карточке
- `.pack-card-video` - видео стикер в карточке
- `.pack-card-image` - изображение стикера в карточке

## CSS анимации

### Keyframes:
- `@keyframes floatColumn1` - анимация левой колонки (вертикальное движение)
- `@keyframes floatColumn2` - анимация правой колонки (вертикальное движение)
- `@keyframes shimmer` - анимация skeleton loader
- `@keyframes pulse` - пульсация для skeleton элементов
- `@keyframes likePulse` - радиальная волна при лайке
- `@keyframes likeHeart` - анимация сердечка при лайке
- `@keyframes particle-0` до `particle-7` - анимации частиц при лайке
- `@keyframes spin` - вращение для индикатора загрузки

## DOM элементы и структура

### Основная структура:
```
<div className="simpleGallery">
  <div className="gallery-overlay"> {/* controlsElement, addButtonElement */}
  <LoadingSpinner /> {/* если isRefreshing */}
  <div className="gallery-items">
    {/* Режим виртуализации: */}
    <VirtualizedGallery />
    
    {/* Обычный режим: */}
    <div className="gallery-column-float-1"> {/* Левая колонка */}
      {/* Skeleton loaders или PackCard элементы */}
    </div>
    <div className="gallery-column-float-2"> {/* Правая колонка */}
      {/* Skeleton loaders или PackCard элементы */}
    </div>
  </div>
  {/* Индикатор загрузки */}
  {/* Sentinel для infinite scroll */}
</div>
```

### Элементы внутри PackCard:
```
<div className="pack-card">
  <div> {/* Контейнер стикеров */}
    {/* Skeleton loader или */}
    <AnimatedSticker /> {/* для анимированных */}
    <video /> {/* для видео */}
    <img /> {/* для статичных */}
  </div>
  <div> {/* Заголовок пака */}
  <InteractiveLikeCount /> {/* Счетчик лайков */}
  {/* Анимация лайка (если активна) */}
</div>
```

## Ref'ы и DOM ссылки

- `containerRef` - ссылка на основной контейнер галереи
- `sentinelRef` - ссылка на элемент-триггер для infinite scroll
- `scrollPositionRef` - сохранение позиции скролла
- `lastScrollTopRef` - последняя позиция скролла для определения направления
- `virtualizationDecisionRef` - решение о виртуализации
- `lastPacksLengthRef` - последняя длина массива паков

## Хуки и утилиты для отображения

### Хуки:
- `useSmartCache` - умное кэширование данных
- `useNearVisible` - определение видимости элемента (в PackCard)
- `useStickerRotation` - ротация стикеров в карточке
- `useDebounce` - дебаунсинг (используется в родительских компонентах)

### Утилиты:
- `imageLoader` - загрузка изображений с приоритетами
- `prefetchAnimation`, `markAsGalleryAnimation` - предзагрузка анимаций
- `prefetchSticker`, `getCachedStickerUrl`, `markAsGallerySticker` - работа со стикерами
- `throttle` - троттлинг событий скролла

## Состояния и флаги отображения

### В SimpleGallery:
- `visiblePacks` - мемоизированный список видимых паков
- `shouldUseVirtualization` - флаг использования виртуализации
- `isPageScroll` - режим скролла (страница или контейнер)
- `hideControls` - скрытие элементов управления при скролле вниз

### В VirtualizedGallery:
- `visibleRange` - вычисляемый диапазон видимых элементов
- `visiblePacks` - срез массива паков для отображения
- `offsetY` - вертикальное смещение для виртуализации

### В PackCard:
- `isNear` - элемент близко к видимой области
- `currentStickerIndex` - текущий индекс стикера в ротации

## IntersectionObserver

- Основной observer для infinite scroll (sentinel)
- Prefetch observer для предзагрузки следующей страницы
- Observer в `useNearVisible` для определения видимости карточек

## События и обработчики

- `handleScroll` - обработчик скролла для ленивой загрузки
- `handlePackClick` - обработчик клика по карточке
- `handleLikeAnimation` - обработчик анимации лайка
- `throttledScrollHandler` - троттлированный обработчик скролла для скрытия контролов

## Оптимизации отображения

1. **Виртуализация** - рендеринг только видимых элементов при большом количестве
2. **Мемоизация** - `memo` с кастомной функцией сравнения
3. **Ленивая загрузка** - показ элементов по мере скролла
4. **Skeleton loading** - показ placeholder'ов во время загрузки
5. **Приоритетная загрузка** - разные приоритеты для первых 6 паков
6. **Кэширование** - умное кэширование через `useSmartCache`
7. **Prefetching** - предзагрузка следующей страницы заранее

## Пропсы, влияющие на отображение

- `packs` - массив паков для отображения
- `enablePreloading` - включение предзагрузки
- `batchSize` - размер батча для ленивой загрузки
- `hasNextPage` - наличие следующей страницы
- `isLoadingMore` - флаг загрузки дополнительных данных
- `isRefreshing` - флаг обновления данных
- `usePageScroll` / `scrollMode` - режим скролла
- `addButtonElement` - кнопка добавления как первый элемент
- `controlsElement` - элементы управления сверху
- `onPackClick` - обработчик клика
- `onLoadMore` - обработчик загрузки следующей страницы

