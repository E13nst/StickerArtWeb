---
name: WebM прозрачность фикс - устранение white flash
overview: Устранить white flash и уменьшить "стабильно белый" кейс у WebM-стикеров (VP9+alpha) через стабилизацию src видео, удаление CSS фильтров и добавление opacity до готовности. Минимальные изменения в PackCard.tsx, StickerPreview.tsx и StickerThumbnail.tsx. Без изменений в логике воспроизведения (loop/autoplay) и viewport.
todos:
  - id: create-hook
    content: Создать хук useNonFlashingVideoSrc в miniapp/src/hooks/useNonFlashingVideoSrc.ts с логикой стабильного выбора src, micro-wait на blob до показа, session-level память brokenPreferred
    status: pending
  - id: patch-packcard
    content: "Обновить PackCard.tsx: использовать useNonFlashingVideoSrc, убрать императивные video.src=, убрать filter с контейнера (заменить overlay), добавить opacity до готовности, НЕ менять autoplay/loop/viewport"
    status: pending
    dependencies:
      - create-hook
  - id: patch-preview
    content: "Обновить StickerPreview.tsx: использовать useNonFlashingVideoSrc с video URL fallback, убрать императивные video.src=, добавить opacity до готовности, НЕ менять autoplay/loop/viewport"
    status: pending
    dependencies:
      - create-hook
  - id: patch-thumbnail
    content: "Обновить StickerThumbnail.tsx: заменить backgroundColor на transparent для placeholder/skeleton, видео НЕ добавлять"
    status: pending
---

# План исправления мерцания белого фона у WebM-стикеров

## Цель

Устранить white flash и уменьшить "стабильно белый" кейс, вызванный неправильным выбором источника (URL без альфы vs BLOB с альфой), при этом не менять поведение воспроизведения (loop/autoplay) и viewport-логику.

## Контекст и причины проблемы

White flash и стабильный белый фон вызваны фронтовыми факторами:

- **Поздняя смена src**: вычисление `src={blobCache.get(fileId) || url}` в render приводит к переключению URL→BLOB после первого кадра → реинициализация декодера → white flash
- **Retry-циклы**: императивные `video.src = ...` в `onError` создают циклы переключения blob↔url → повторные реинициализации
- **CSS filter/композитинг**: `filter: grayscale(...)` на контейнере видео пересобирает композитинг слоя → white flash
- **Показ до ready**: видео становится видимым до `loadeddata/canplay`, когда декодер еще не готов → пустой слой выглядит белым
- **Разные источники**: URL может быть без альфы, а BLOB с альфой появляется позже → если стартуем с URL, получаем "стабильно белый"

## Компоненты для изменения

- `miniapp/src/components/PackCard.tsx` - pack-card-video
- `miniapp/src/components/StickerSetDetail/StickerPreview.tsx` - видео в превью
- `miniapp/src/components/StickerThumbnail.tsx` - только стили placeholder (WebP `<img>`, видео не добавлять)

## Задачи

### 1. Создать хук `useNonFlashingVideoSrc`

**Файл**: `miniapp/src/hooks/useNonFlashingVideoSrc.ts` (новый файл)

**Сигнатура**:

```typescript
useNonFlashingVideoSrc({
  fileId: string,
  preferredSrc: string | undefined,  // blob URL
  fallbackSrc: string,                // обычный URL (всегда video URL)
  waitForPreferredMs?: number        // по умолчанию 100ms (80-150ms)
}): {
  src: string | undefined,
  isReady: boolean,
  onError: (e: React.SyntheticEvent<HTMLVideoElement>) => void,
  onLoadedData: () => void
}
```

**Логика выбора src ДО показа**:

1. **Session-level память**: module-level `Set<string>` `brokenPreferred` для fileId, где blob (preferredSrc) уже падал

   - Применяется только к blob (preferredSrc), чтобы не блокировать обычный URL (fallbackSrc)
   - При повторном монтировании такого fileId стартуем сразу с `fallbackSrc` (без попыток blob)

2. **При смене `fileId`**:

   - **Сброс `isReady = false`** (обязательно)
   - Если `fileId` в `brokenPreferred` → сразу `candidateSrc = fallbackSrc`
   - Иначе:
     - Если `preferredSrc` (blob) уже есть СЕЙЧАС → `candidateSrc = preferredSrc`
     - Иначе → запускаем **короткое окно ожидания** (`waitForPreferredMs`, по умолчанию 100ms):
       - **ВАЖНО**: micro-wait выполняется только если видео еще НЕ показано (`opacity: 0` / `isReady = false`)
       - Видео остается скрытым (`opacity: 0`)
       - Если blob появился в этом окне → `candidateSrc = preferredSrc`
       - Иначе → `candidateSrc = fallbackSrc`
       - **HARD RULE**: если `preferredSrc` приходит позже, чем окно ожидания, мы НЕ делаем URL→BLOB, чтобы не провоцировать мерцание

3. **После выбора src**:

   - `src` устанавливается один раз и НЕ меняется до смены `fileId` или ошибки blob
   - Видео рендерится с выбранным `src`

4. **После того, как видео стало ready** (`isReady = true`):

   - **КРИТИЧНО**: `src` больше НЕ меняем (исключение: blob error → fallback на URL, один раз)
   - **Запрет на переключение URL→BLOB** после того, как видео стало видимым

5. **Обработка ошибок** (`onError`):

   - Если текущий `src === preferredSrc` (blob) → один раз переключить на `fallbackSrc` + добавить `fileId` в `brokenPreferred` + **сброс `isReady = false` до `loadeddata`**
   - Если уже fallback → ничего не делаем (только DEV-log)

6. **Готовность видео** (`onLoadedData`/`onCanPlay`):

   - Устанавливает `isReady = true`
   - Видео становится видимым (`opacity: 1`)

7. **Обязательно**: хук НЕ использует императивные `video.src = ...`, только state через React

**DEV-логирование** (под `import.meta.env.DEV`):

- fileId
- выбранный src тип: 'blob'|'url'
- события: loadstart/loadeddata/canplay/error/stalled/abort
- факт использования brokenPreferred
- факт micro-wait и его результат (blob появился/не появился)

### 2. Patch PackCard.tsx

**Изменения**:

1. **Убрать динамический src из render**:

   - Удалить `src={videoBlobCache.get(activeSticker.fileId) || activeSticker.url}` из JSX

2. **Использовать `useNonFlashingVideoSrc`**:
   ```typescript
   const { src, isReady, onError, onLoadedData } = useNonFlashingVideoSrc({
     fileId: activeSticker.fileId,
     preferredSrc: videoBlobCache.get(activeSticker.fileId),  // blob URL если есть
     fallbackSrc: activeSticker.url,                          // обычный video URL
     waitForPreferredMs: 100
   });
   ```


   - В JSX: `<video src={src} onError={onError} onLoadedData={onLoadedData} ... />`

3. **Удалить императивные замены src**:

   - Удалить все `video.src = ...` из `onError` (строки 372, 377, 382)
   - Убрать retry-циклы в `onError` - только один fallback через хук
   - Использовать `onError` и `onLoadedData` из хука

4. **Убрать CSS filter с контейнера**:

   - Убрать `filter: grayscale(...)` (и любые filter) с контейнера карточки (строка 276)
   - Для dimming (`isDimmed`) добавить overlay div:
     - `position: absolute`, `inset: 0`, `pointer-events: none`
     - `background: rgba(0, 0, 0, 0.5)` или градиент с opacity
     - Видео слой должен быть "чистым" (без filter)
   - Не добавлять `backdrop-filter` и не анимировать `transform` на контейнере видео

5. **Добавить opacity до готовности**:

   - `style={{ opacity: isReady ? 1 : 0, transition: 'opacity 120ms ease', backgroundColor: 'transparent', ... }}`
   - Под видео должен быть прозрачный фон (фон галереи), не белый

6. **Сохранить текущее поведение** (НЕ менять):

   - **НЕ менять** `autoPlay`, `loop`, `muted`, `playsInline` - остаются как есть
   - **НЕ менять** текущие эффекты/обработчики, связанные с viewport (если они есть)
   - **НЕ добавлять** pause/play логику
   - Вся логика viewport/IntersectionObserver - без изменений
   - НЕ менять поведение playback

### 3. Patch StickerPreview.tsx

**Изменения**:

1. **Заменить динамический src на `useNonFlashingVideoSrc`**:
   ```typescript
   const { src, isReady, onError, onLoadedData } = useNonFlashingVideoSrc({
     fileId: sticker.file_id,
     preferredSrc: videoBlobCache.get(sticker.file_id),  // blob URL если есть
     fallbackSrc: sticker.url || getStickerVideoUrl(sticker.file_id),  // ВАЖНО: video URL
     waitForPreferredMs: 100
   });
   ```


   - **ВАЖНО про fallbackSrc**: `fallbackSrc` всегда должен быть **video URL** (не image URL)
   - Если в модели стикера уже есть `sticker.url` (webm) → использовать `sticker.url` как fallbackSrc
   - Если webm URL получаете через отдельный helper → создать/использовать `getStickerVideoUrl(sticker.file_id)` (новое имя)
   - **В `<video>` больше НЕ используется `getStickerImageUrl`**. `getStickerImageUrl` остается строго для `<img>`
   - **Image fallback как last-resort UI**: если video URL недоступен и нужно показать что-то, это должно быть отдельной веткой рендера (например, условный `<img>` вместо `<video>`), но НЕ как `fallbackSrc` для `<video>`
   - Видео остается видео - НЕ подставлять WebM в `<img>` и не подставлять image URL в `<video src>`

2. **Удалить императивные замены src**:

   - Удалить все `video.src = ...` из `onError` (строки 128, 132, 137)
   - Убрать retry-циклы - только один fallback через хук
   - Использовать `onError` и `onLoadedData` из хука

3. **Добавить opacity до готовности**:

   - `style={{ opacity: isReady ? 1 : 0, transition: 'opacity 120ms ease', backgroundColor: 'transparent', ... }}`

4. **Убедиться, что нет фильтров**:

   - Нет `filter`, `backdrop-filter` на контейнере видео

5. **Сохранить текущее поведение** (НЕ менять):

   - **НЕ менять** `autoPlay`, `loop`, `muted`, `playsInline` - остаются как есть
   - **НЕ менять** текущие эффекты/обработчики, связанные с viewport (если они есть)
   - **НЕ добавлять** pause/play логику
   - Логика loop/autoplay без изменений

### 4. Patch StickerThumbnail.tsx

**ВАЖНО**: StickerThumbnail остается WebP `<img>`, видео НЕ добавлять.

**Изменения** (только стили placeholder):

1. **Убрать заливки placeholder/skeleton**:

   - Заменить `backgroundColor: 'rgba(0,0,0,0.1)'` на `transparent` (строки 73, 97)
   - Убедиться, что img имеет `backgroundColor: 'transparent'` в style
   - Убедиться, что wrapper контейнер не имеет белых/серых заливок

2. **Skeleton/placeholder**:

   - Должен быть прозрачным или цветом фонового контейнера галереи, но не белым

3. **Никаких изменений логики загрузки и типов медиа**:

   - Остается WebP `<img>`
   - Логика загрузки без изменений
   - Не трогаем загрузку и типы медиа

## Критерии приемки

- ✅ **White flash/мерцание исчезает** (или становится невоспроизводимым) при скролле и в preview
- ✅ **Нет смены src после ready** (исключение: blob→url после error, один раз) - подтверждается DEV-логами
- ✅ **Нет CSS фильтров** на видео-слое (filter/backdrop-filter убраны, заменены overlay где нужно)
- ✅ **"Стабильно белый" уменьшается** за счет micro-wait на blob до первого показа
- ✅ **Видео остается с loop/autoplay** как было - никаких изменений в playback логике
- ✅ **IntersectionObserver/viewport логика не изменена** - НЕ добавлять паузы, НЕ менять поведение pausing
- ✅ **StickerThumbnail остается WebP** - только стили placeholder, видео не добавляется
- ✅ **FallbackSrc в StickerPreview** - всегда video URL (не image), image fallback только как отдельная UI-ветка (last-resort)

---

## Diff Summary: что изменилось в плане

- **Исправлено противоречие в StickerPreview fallback**: `fallbackSrc` теперь явно определен как всегда video URL (не image). В `<video>` больше не используется `getStickerImageUrl`. Для fallback video URL используется `sticker.url` (если это webm) или новый helper `getStickerVideoUrl(...)`. `getStickerImageUrl` остаётся строго для `<img>`. Image fallback описан как отдельная last-resort UI-ветка (условный `<img>` вместо `<video>`), не смешивается с `fallbackSrc`

- **Уточнена стратегия micro-wait**: добавлено явное правило (HARD RULE), что micro-wait выполняется только если видео еще не показано, и если preferredSrc приходит позже окна ожидания - НЕ делаем URL→BLOB

- **Зафиксирован reset isReady**: явно указано, что `isReady` сбрасывается при смене fileId и при переключении src на fallback после onError (blob→url)

- **Уточнен session-level brokenPreferred**: явно указано, что применяется только к blob (preferredSrc), чтобы не блокировать обычный URL (fallbackSrc)

- **Уточнено "не трогать playback/viewport"**: в каждом patch-разделе (PackCard, StickerPreview) добавлены явные строки про "не менять autoplay/loop/muted/playsInline", "не менять текущие эффекты/обработчики viewport", "не добавлять pause/play"

- **Уточнен StickerThumbnail**: явно указано, что меняем только цвета placeholder/skeleton на transparent/фон галереи, не трогаем загрузку и типы медиа

- **Обновлены критерии приемки**: fallbackSrc в StickerPreview теперь явно определен как video URL, image fallback только как отдельная UI-ветка