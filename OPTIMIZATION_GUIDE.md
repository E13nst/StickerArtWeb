# Руководство по оптимизации галереи изображений

## 1. Анализ архитектуры

### 1.1 Текущая схема потока данных

```
Клиент (React) → API Client → Backend → БД/Хранилище → CDN/Telegram Bot API
                    ↓
            ImageLoader (очередь) → Кеш → DOM рендер
```

### 1.2 Точки возникновения нагрузки

#### **Клиент:**
- Рендеринг большого количества DOM-элементов
- Одновременная загрузка десятков изображений
- Обработка событий скролла/IntersectionObserver
- Операции с памятью (кеш изображений)

#### **Сервер:**
- Запросы к БД при пагинации (SELECT с LIMIT/OFFSET)
- Проксирование запросов к Telegram Bot API (`/api/proxy/stickers/{fileId}`)
- Отсутствие кеширования на уровне сервера

#### **Сеть:**
- Множественные HTTP-запросы (по одному на каждое изображение)
- Последовательная загрузка без группировки
- Отсутствие сжатия/оптимизации изображений

#### **Изображения:**
- Загрузка полных файлов без resize/сжатия
- Отсутствие форматов нового поколения (WebP/AVIF)
- Нет lazy loading на уровне `<img loading="lazy">`

---

## 2. Стратегия оптимизации

### 2.1 Что загружать сразу (Eager Load)

**Первичная загрузка:**
- Первые 6-12 паков (в зависимости от viewport)
- Только первое изображение каждого пака (preview)
- Метаданные паков (title, likes, author)
- Критичный CSS/JS

**Приоритет загрузки (TIER):**
```
TIER_1: Первые 6 паков (все preview-изображения)
TIER_2: Первое изображение каждого пака (в viewport)
TIER_3: Остальные preview-изображения видимых паков
TIER_4: Фоновые паки (ниже viewport)
```

### 2.2 Что загружать лениво (Lazy Load)

**Отложенная загрузка:**
- Изображения вне viewport (IntersectionObserver)
- Дополнительные изображения пака (при hover/click)
- Следующая страница пагинации (prefetch за 100px до конца)
- Метаданные авторов (не критично)
- Анимации и иконки

**Условия загрузки:**
```typescript
// Загружать только если:
- Элемент в viewport или близко (rootMargin: '200px')
- Пользователь не в фоне (document.visibilityState === 'visible')
- Не превышен лимит активных загрузок (maxConcurrency)
- Устройство не в режиме экономии трафика (navigator.connection?.saveData)
```

### 2.3 Элементы для условного отображения

**Не рендерить или скрывать:**
- Паки вне viewport (виртуализация)
- Полные изображения до hover/click (show только preview)
- Анимации при `prefers-reduced-motion: reduce`
- Слайдшоу при скрытой вкладке (`document.hidden`)
- Дополнительные метаданные до раскрытия карточки

---

## 3. Группировка и очереди

### 3.1 Группировка медиа

**Batch-загрузка изображений:**
```typescript
// Вместо параллельных 50+ запросов
// Группируем по батчам по 5-10 изображений

const BATCH_SIZE = {
  mobile: 5,
  tablet: 8,
  desktop: 10
};

// Адаптивный размер батча
const batchSize = window.innerWidth < 768 ? 5 : 
                  window.innerWidth < 1024 ? 8 : 10;
```

**Группировка по приоритету:**
```typescript
// Сначала все TIER_1, затем TIER_2, и т.д.
queue.sort((a, b) => b.priority - a.priority);
```

### 3.2 Очередь загрузки

**Приоритетная очередь:**
- Использовать `PriorityQueue` вместо простого массива
- Динамическое изменение приоритета (при скролле)
- Отмена низкоприоритетных при нехватке ресурсов

**Ограничения:**
```typescript
maxConcurrency: {
  mobile: 3-5,    // Меньше на слабых устройствах
  tablet: 6-8,
  desktop: 10-12
}

// Автоопределение по connection API
const connection = navigator.connection;
const maxConcurrency = connection?.effectiveType === '4g' ? 10 :
                       connection?.effectiveType === '3g' ? 5 : 3;
```

### 3.3 Prefetch стратегия

**Агрессивный prefetch:**
- Следующая страница пагинации (за 200px до конца)
- Изображения соседних паков (по горизонтали)
- Первое изображение следующего батча

**Консервативный prefetch:**
- Только при `requestIdleCallback` доступен
- Таймаут 2-3 секунды для idle-загрузки
- Прекращать при активном скролле

---

## 4. Кеширование

### 4.1 Клиентское кеширование

**Browser Cache:**
```typescript
// Service Worker для кеширования изображений
// Cache API с TTL
// IndexedDB для метаданных паков
```

**In-memory кеш:**
```typescript
// LRU кеш с ограничением по памяти
maxSize: 200 изображений
TTL: 5-10 минут
eviction: при превышении лимита
```

**HTTP Cache Headers:**
```
Cache-Control: public, max-age=3600, immutable
ETag: для валидации
```

### 4.2 Серверное кеширование

**Backend:**
- Redis кеш для списка паков (TTL: 5-10 минут)
- Кеширование проксированных изображений от Telegram API
- Кеш результатов поиска (TTL: 1-2 минуты)

**CDN:**
- Статические изображения через CDN
- Long-term caching для immutable ресурсов

### 4.3 Стратегии инвалидации

- Инвалидация при обновлении пака
- Частичная инвалидация (только измененные элементы)
- Stale-while-revalidate для фонового обновления

---

## 5. Оптимизация изображений

### 5.1 Форматы

**Приоритет форматов:**
1. AVIF (современные браузеры)
2. WebP (fallback)
3. JPEG/PNG (legacy)

**Определение поддержки:**
```typescript
const supportsAVIF = await fetch('/test.avif').then(r => r.ok).catch(() => false);
const supportsWebP = await fetch('/test.webp').then(r => r.ok).catch(() => false);
```

### 5.2 Размеры и сжатие

**Responsive images:**
```html
<img 
  srcset="image-320w.webp 320w,
          image-640w.webp 640w,
          image-1024w.webp 1024w"
  sizes="(max-width: 768px) 320px,
         (max-width: 1024px) 640px,
         1024px"
  loading="lazy"
/>
```

**Оптимизация:**
- Resize на сервере (thumbnails для preview)
- Quality: 80-85 для WebP, 70-75 для JPEG
- Progressive JPEG для лучшего UX

### 5.3 Blur placeholder

**LQIP (Low Quality Image Placeholder):**
```typescript
// 20x20px blur placeholder в base64
// Показывать до загрузки полноразмерного
const placeholder = `data:image/svg+xml;base64,...`;
```

---

## 6. Метрики производительности

### 6.1 Core Web Vitals

**LCP (Largest Contentful Paint):**
- Цель: < 2.5s
- Измерение: время загрузки первого preview-изображения
- Оптимизация: priority loading для LCP-элемента

**FCP (First Contentful Paint):**
- Цель: < 1.8s
- Измерение: первый рендер контента
- Оптимизация: critical CSS, inline styles

**TTFB (Time to First Byte):**
- Цель: < 600ms
- Измерение: время ответа сервера
- Оптимизация: кеширование, CDN, оптимизация БД-запросов

**CLS (Cumulative Layout Shift):**
- Цель: < 0.1
- Измерение: стабильность layout
- Оптимизация: резервирование места под изображения (aspect-ratio)

**FID/INP (First Input Delay / Interaction to Next Paint):**
- Цель: < 100ms / < 200ms
- Измерение: отзывчивость интерфейса
- Оптимизация: debounce/throttle событий, виртуализация

### 6.2 Дополнительные метрики

**Специфичные для галереи:**
- Time to First Image (TTFI): время до первого изображения
- Images Loaded per Second: скорость загрузки
- Cache Hit Rate: процент попаданий в кеш
- Scroll Performance: FPS при скролле
- Memory Usage: потребление памяти браузером

### 6.3 Сбор телеметрии

**Методы сбора:**

**1. Performance API:**
```typescript
// Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);

// Custom метрики
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'measure') {
      // Отправка на сервер аналитики
      sendMetric(entry.name, entry.duration);
    }
  }
});
observer.observe({ entryTypes: ['measure'] });
```

**2. IntersectionObserver для загрузки:**
```typescript
// Отслеживание видимости изображений
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const loadTime = performance.now() - entry.target.dataset.startTime;
      sendMetric('image_visible_time', loadTime);
    }
  });
});
```

**3. Resource Timing API:**
```typescript
// Время загрузки ресурсов
const resources = performance.getEntriesByType('resource');
resources.forEach(resource => {
  if (resource.name.includes('/stickers/')) {
    sendMetric('image_load_time', {
      duration: resource.duration,
      transferSize: resource.transferSize,
      decodeTime: resource.decodedBodySize
    });
  }
});
```

**4. Memory API (если доступен):**
```typescript
if ('memory' in performance) {
  const memory = (performance as any).memory;
  sendMetric('memory_usage', {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit
  });
}
```

**5. Connection API:**
```typescript
const connection = navigator.connection;
if (connection) {
  sendMetric('connection_info', {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData
  });
}
```

**Интеграция с аналитикой:**
```typescript
// Отправка на backend/аналитику
async function sendMetric(name: string, value: number | object) {
  // Batch отправка каждые 5 секунд
  metricQueue.push({ name, value, timestamp: Date.now() });
  
  if (metricQueue.length >= 10 || Date.now() - lastSend > 5000) {
    await fetch('/api/metrics', {
      method: 'POST',
      body: JSON.stringify(metricQueue),
      headers: { 'Content-Type': 'application/json' }
    });
    metricQueue = [];
    lastSend = Date.now();
  }
}
```

---

## 7. Практические рекомендации

### 7.1 Немедленные действия

1. **Добавить `loading="lazy"` для всех изображений вне viewport**
2. **Ограничить `maxConcurrency` до 5-8 на мобильных**
3. **Включить виртуализацию при >100 элементах**
4. **Добавить aspect-ratio для предотвращения CLS**
5. **Реализовать blur placeholder для первых изображений**

### 7.2 Среднесрочные улучшения

1. **Внедрить Service Worker для кеширования**
2. **Оптимизировать изображения на сервере (resize, WebP)**
3. **Добавить Redis кеш на backend**
4. **Реализовать batch-загрузку изображений**
5. **Настроить CDN для статических ресурсов**

### 7.3 Долгосрочная оптимизация

1. **Миграция на AVIF/WebP с fallback**
2. **Внедрение HTTP/3 для параллельной загрузки**
3. **Использование Image CDN (Cloudinary, Imgix)**
4. **Оптимизация БД-запросов (индексы, материализованные представления)**
5. **Progressive Web App (PWA) с offline-режимом**

---

## 8. Чеклист оптимизации

- [ ] Lazy loading для изображений вне viewport
- [ ] Виртуализация списков (>100 элементов)
- [ ] Приоритетная очередь загрузки
- [ ] Ограничение concurrency по типу устройства
- [ ] Кеширование (in-memory + HTTP cache)
- [ ] Оптимизация изображений (WebP, resize)
- [ ] Blur placeholder для LCP
- [ ] Aspect-ratio для предотвращения CLS
- [ ] Мониторинг Web Vitals
- [ ] Batch-загрузка изображений
- [ ] Prefetch следующей страницы
- [ ] Отмена низкоприоритетных загрузок
- [ ] Service Worker для offline
- [ ] CDN для статических ресурсов
- [ ] Redis кеш на backend















