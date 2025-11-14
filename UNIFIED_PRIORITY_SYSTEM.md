# Единая система приоритетов для загрузки стикеров

## Обзор изменений

Все загрузки изображений через sticker-processor теперь используют единую систему приоритетов через `imageLoader`.

## Что изменилось

### 1. Обновлен `prefetchSticker`

Функция `prefetchSticker` теперь использует `imageLoader` с поддержкой приоритетов:

```typescript
prefetchSticker(fileId, url, {
  isAnimated: boolean,
  isVideo: boolean,
  markForGallery: boolean,
  priority: LoadPriority // Новый параметр
})
```

**Изменения:**
- Для обычных изображений используется `imageLoader.loadImage()` с указанным приоритетом
- Для анимаций остается `prefetchAnimation()` (загружает JSON)
- Для видео используется старая логика (blob)

### 2. Модальное окно использует TIER_0_MODAL

В `StickerSetDetail.tsx` все загрузки стикеров в модальном окне используют максимальный приоритет:

```typescript
// Предзагрузка первых 20 стикеров
prefetchSticker(sticker.file_id, imageUrl, {
  isAnimated: Boolean(sticker.is_animated),
  isVideo: Boolean(sticker.is_video),
  markForGallery: true,
  priority: LoadPriority.TIER_0_MODAL // Максимальный приоритет
})

// Загрузка текущего активного стикера
prefetchSticker(currentSticker.file_id, getStickerImageUrl(currentSticker.file_id), {
  isAnimated: Boolean(currentSticker.is_animated),
  isVideo: Boolean(currentSticker.is_video),
  markForGallery: true,
  priority: LoadPriority.TIER_0_MODAL // Максимальный приоритет
})
```

## Преимущества

1. ✅ **Единая система приоритетов** - все загрузки через sticker-processor используют `imageLoader`
2. ✅ **Максимальный приоритет для модального окна** - стикеры в модальном окне загружаются с приоритетом 5 (TIER_0_MODAL)
3. ✅ **Оптимизация очереди** - система приоритетов управляет всеми загрузками централизованно
4. ✅ **Совместимость** - старый код продолжает работать (по умолчанию используется TIER_4_BACKGROUND)

## Приоритеты по сценариям

| Сценарий | Приоритет | Значение |
|----------|-----------|----------|
| **Модальное окно** | `TIER_0_MODAL` | 5 (максимальный) |
| **Первые 6 видимых паков (1-й стикер)** | `TIER_1_FIRST_6_PACKS` | 4 |
| **Остальные видимые паки (1-й стикер)** | `TIER_2_FIRST_IMAGE` | 3 |
| **Видимые паки (2-й, 3-й стикеры)** | `TIER_2` или `TIER_3` | 3 или 2 |
| **Невидимые паки** | `TIER_2` или `TIER_3` | 3 или 2 |
| **По умолчанию (старый код)** | `TIER_4_BACKGROUND` | 1 |

## Миграция существующего кода

Если в коде используется `prefetchSticker` без указания приоритета, он автоматически использует `TIER_4_BACKGROUND` (низкий приоритет).

Для повышения приоритета нужно явно указать:

```typescript
// Низкий приоритет (по умолчанию)
prefetchSticker(fileId, url, { isAnimated: false })

// Высокий приоритет
prefetchSticker(fileId, url, { 
  isAnimated: false,
  priority: LoadPriority.TIER_2_FIRST_IMAGE 
})

// Максимальный приоритет (для модального окна)
prefetchSticker(fileId, url, { 
  isAnimated: false,
  priority: LoadPriority.TIER_0_MODAL 
})
```

## Файлы изменений

1. `miniapp/src/utils/animationLoader.ts` - обновлен `prefetchSticker` для использования `imageLoader`
2. `miniapp/src/components/StickerSetDetail.tsx` - использует `TIER_0_MODAL` для модального окна
3. `PRIORITY_TABLE.md` - обновлена документация

