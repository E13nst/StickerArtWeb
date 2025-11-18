# 🎯 План обновления системы приоритетов загрузки

## Текущие проблемы:
1. ❌ Приоритет назначается статически (первые 6 карточек)
2. ❌ Нет механизма вытеснения
3. ❌ Приоритет не меняется при скролле
4. ❌ Карточки вне viewport получают высокий приоритет

## Новая система приоритетов:

```typescript
enum LoadPriority {
  TIER_0_MODAL = 5,              // Модальное окно
  TIER_1_VIEWPORT = 4,           // ✅ Видимые в viewport прямо сейчас
  TIER_2_NEAR_VIEWPORT = 3,      // ✅ В пределах 800px от viewport
  TIER_3_ADDITIONAL = 2,         // Остальные загруженные (фоновая ротация)
  TIER_4_BACKGROUND = 1,         // Предзагрузка вне зоны видимости
}
```

---

## 🔧 Изменения в коде:

### 1. **`miniapp/src/hooks/useViewportVisibility.ts`** (новый хук)

```typescript
/**
 * Хук для определения видимости в viewport
 * 
 * @param rootMargin - отступ для IntersectionObserver
 * @returns { isInViewport, isNearViewport }
 */
export const useViewportVisibility = (
  ref: React.RefObject<Element>, 
  options?: { rootMargin?: string }
) => {
  const [isInViewport, setIsInViewport] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Точный viewport (для TIER_1)
    const strictObserver = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { rootMargin: '0px', threshold: 0.1 }
    );

    // Расширенная зона (для TIER_2)
    const nearObserver = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: options?.rootMargin || '800px', threshold: 0 }
    );

    strictObserver.observe(element);
    nearObserver.observe(element);

    return () => {
      strictObserver.disconnect();
      nearObserver.disconnect();
    };
  }, [ref, options?.rootMargin]);

  return { isInViewport, isNearViewport };
};
```

---

### 2. **`miniapp/src/components/PackCard.tsx`** (обновить логику приоритетов)

**Было:**
```typescript
let priority: LoadPriority;
if (isNear) {
  priority = isHighPriority ? LoadPriority.TIER_1_FIRST_6_PACKS : LoadPriority.TIER_2_FIRST_IMAGE;
} else {
  priority = isHighPriority ? LoadPriority.TIER_2_FIRST_IMAGE : LoadPriority.TIER_3_ADDITIONAL;
}
```

**Стало:**
```typescript
// Добавляем новый хук
const { isInViewport, isNearViewport } = useViewportVisibility(ref);

let priority: LoadPriority;
if (isInViewport) {
  // Видимая прямо сейчас - максимальный приоритет
  priority = LoadPriority.TIER_1_VIEWPORT;
} else if (isNearViewport) {
  // Близко к viewport - высокий приоритет
  priority = LoadPriority.TIER_2_NEAR_VIEWPORT;
} else if (isNear) {
  // Далеко, но в зоне 800px - средний приоритет
  priority = LoadPriority.TIER_3_ADDITIONAL;
} else {
  // Совсем далеко - низкий приоритет
  priority = LoadPriority.TIER_4_BACKGROUND;
}
```

---

### 3. **`miniapp/src/utils/imageLoader.ts`** (механизм вытеснения)

```typescript
/**
 * 🔥 НОВОЕ: Обновление приоритета для уже загружающихся элементов
 */
public updatePriority(fileId: string, newPriority: LoadPriority): void {
  // Обновляем приоритет в очереди
  const queueItem = this.queue.queue.find(item => item.fileId === fileId);
  if (queueItem) {
    queueItem.priority = newPriority;
    // Пересортировываем очередь
    this.queue.queue.sort((a, b) => b.priority - a.priority);
  }

  // Обновляем приоритет активной загрузки
  if (this.activePriorities.has(fileId)) {
    this.activePriorities.set(fileId, newPriority);
  }
}

/**
 * 🔥 НОВОЕ: Вытеснение низкоприоритетных элементов
 * Вызывается когда новый TIER_1 элемент не может начать загрузку
 */
private evictLowPriorityItems(): void {
  // Находим самый низкоприоритетный активный элемент
  let lowestPriority = Infinity;
  let lowestFileId: string | null = null;

  this.activePriorities.forEach((priority, fileId) => {
    if (priority < lowestPriority && priority < LoadPriority.TIER_2_NEAR_VIEWPORT) {
      lowestPriority = priority;
      lowestFileId = fileId;
    }
  });

  // Если нашли - приостанавливаем его загрузку
  if (lowestFileId) {
    console.log(`⏸️ Вытеснение низкоприоритетного элемента: ${lowestFileId} (priority: ${lowestPriority})`);
    // TODO: Реализовать механизм отмены fetch через AbortController
  }
}
```

---

### 4. **`miniapp/src/components/SimpleGallery.tsx`** (удалить статическую логику)

**Убрать:**
```typescript
isHighPriority={index < 6}  // ❌ Удалить эту строку
```

**PackCard теперь сам определяет приоритет через `useViewportVisibility`**

---

## 📊 Ожидаемые улучшения:

1. ✅ **Динамическая приоритизация**: Приоритет меняется при скролле
2. ✅ **Вытеснение**: Новые элементы в viewport получают слоты
3. ✅ **Лучшая производительность**: Загружаются только видимые элементы
4. ✅ **Меньше дубликатов**: Фокус на текущем viewport

---

## 🚀 Дополнительные рекомендации:

### **A. AbortController для отмены запросов**
```typescript
private abortControllers = new Map<string, AbortController>();

private async loadImageFromUrl(fileId: string, url: string): Promise<string> {
  // Создаем AbortController
  const controller = new AbortController();
  this.abortControllers.set(fileId, controller);

  try {
    const img = new Image();
    img.src = normalizedUrl;
    
    // Слушаем сигнал отмены
    controller.signal.addEventListener('abort', () => {
      img.src = ''; // Останавливаем загрузку
    });

    // ... остальной код
  } finally {
    this.abortControllers.delete(fileId);
  }
}

public cancelLoad(fileId: string): void {
  const controller = this.abortControllers.get(fileId);
  if (controller) {
    controller.abort();
    this.abortControllers.delete(fileId);
  }
}
```

### **B. Приоритет для ротирующихся изображений**
```typescript
// В PackCard, когда переключается activeSticker
useEffect(() => {
  if (isInViewport && activeSticker) {
    // Повышаем приоритет активного стикера
    imageLoader.updatePriority(
      activeSticker.fileId, 
      LoadPriority.TIER_1_VIEWPORT
    );
  }
}, [activeSticker, isInViewport]);
```

### **C. Предзагрузка следующих стикеров ротации**
```typescript
// Предзагружаем следующий стикер в ротации с TIER_3
if (isInViewport && nextSticker) {
  imageLoader.loadImage(
    nextSticker.fileId, 
    nextSticker.url, 
    LoadPriority.TIER_3_ADDITIONAL
  );
}
```

---

## ⚠️ Что НЕ стоит делать:

1. ❌ **Слишком частое обновление приоритетов** - debounce минимум 100ms
2. ❌ **Агрессивная отмена запросов** - может привести к бесконечной перезагрузке
3. ❌ **Сложная логика с весами** - держим систему простой

---

## 🧪 Тестирование:

1. Запустить benchmark с новой системой
2. Проверить что карточки в viewport загружаются первыми
3. Проверить что при скролле приоритет меняется
4. Убедиться что вытеснение работает корректно

---

## 📝 Этапы внедрения:

- [ ] **Этап 1**: Создать `useViewportVisibility` хук
- [ ] **Этап 2**: Обновить enum `LoadPriority`
- [ ] **Этап 3**: Интегрировать в `PackCard`
- [ ] **Этап 4**: Добавить `updatePriority()` в `imageLoader`
- [ ] **Этап 5**: Удалить статическую логику из `SimpleGallery`
- [ ] **Этап 6**: Добавить механизм вытеснения (опционально)
- [ ] **Этап 7**: Добавить AbortController (опционально)
- [ ] **Этап 8**: Тестирование

---

## 🎯 Итоговая структура приоритетов:

| Приоритет | Условие | Слоты | Описание |
|-----------|---------|-------|----------|
| **TIER_0_MODAL** | Модальное окно | 6 | Максимальный приоритет |
| **TIER_1_VIEWPORT** | В viewport | 6 | Видимые карточки |
| **TIER_2_NEAR_VIEWPORT** | ±800px от viewport | 12 | Близко к экрану |
| **TIER_3_ADDITIONAL** | Загружено, но далеко | 12 | Ротация, предзагрузка |
| **TIER_4_BACKGROUND** | Вне зоны | Остаток | Фоновая загрузка |

**Total: 30 слотов** (достаточно для 40 карточек с учетом ротации)

