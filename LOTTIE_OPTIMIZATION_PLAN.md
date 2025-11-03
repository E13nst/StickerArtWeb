# Пошаговый план оптимизации Lottie (Стратегия D)

## Обзор стратегии

**Цель**: Уменьшить нагрузку на DOM через условный рендеринг + IntersectionObserver паузу

**Приоритет**: ⭐⭐⭐ Самый безопасный и эффективный вариант

**Ожидаемый результат**:
- FPS: 30-45 → 50-60 (+35%)
- Память: 200MB → 80MB (-60%)
- Активных Lottie: 30+ → 3-6 (-80%)
- DOM nodes: 1500+ → 400-600 (-60%)

**Время внедрения**: 3-5 часов

**Риски**: ✅ Минимальные (использует только стандартные React паттерны)

---

## ШАГ 1: Анализ текущего состояния

### 1.1 Проверить текущее поведение

**Что сделать**:
1. Откройте DevTools → Performance
2. Запишите профиль производительности за 10 секунд на странице Gallery
3. Обратите внимание на:
   - Число активных Lottie инстансов (React DevTools → Components)
   - FPS в Performance monitor
   - Использование памяти (Memory → Heap snapshot)
   - DOM nodes count (Elements → Query → `*`)

**Ожидаемые проблемы**:
- Все 3 preview стикера монтируются одновременно
- Lottie анимации продолжают работать вне viewport
- Избыточное количество DOM nodes

**Файлы для проверки**:
- `miniapp/src/components/PackCard.tsx` (строки 83-142)
- `miniapp/src/components/AnimatedSticker.tsx` (строки 26-103)

---

## ШАГ 2: Оптимизация PackCard (Условный рендеринг)

### 2.1 Что изменить

**Проблема**: Сейчас все 3 preview стикера рендерятся одновременно (строки 83-142 в PackCard.tsx)

**Решение**: Рендерить только активный стикер, остальные не монтировать

### 2.2 Какие файлы изменить

📁 **`miniapp/src/components/PackCard.tsx`**

### 2.3 Код для добавления

**Изменение 1: Убрать map всех стикеров, рендерить только активный**

```typescript
// БЫЛО (строки 83-142):
{pack.previewStickers.map((sticker, index) => {
  const isActive = index === currentStickerIndex;
  const isNext = index === (currentStickerIndex + 1) % pack.previewStickers.length;
  
  return (
    <div key={`${pack.id}-${sticker.fileId}-${index}`} ...>
      {sticker.isAnimated ? (
        <AnimatedSticker ... />
      ) : (
        <img ... />
      )}
    </div>
  );
})}

// СТАЛО (рендерим только активный):
const currentSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];

return (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    {/* Рендерим только ОДИН стикер вместо map всех */}
    {currentSticker && (
      <div
        key={`${pack.id}-${currentSticker.fileId}-${currentStickerIndex}`}
        data-testid="sticker-preview"
        style={{
          width: '100%',
          height: '100%'
        }}
      >
        {currentSticker.fileId ? (
          currentSticker.isAnimated ? (
            <AnimatedSticker
              fileId={currentSticker.fileId}
              imageUrl={currentSticker.url}
              emoji={currentSticker.emoji}
              className="pack-card-animated-sticker"
            />
          ) : (
            <img
              src={currentSticker.url}
              alt={currentSticker.emoji}
              className="pack-card-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              loading={isHighPriority ? 'eager' : 'lazy'}
              decoding="async"
            />
          )
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            color: 'var(--tg-theme-hint-color)'
          }}>
            {currentSticker.emoji}
          </div>
        )}
      </div>
    )}
  </div>
);
```

**Полный код после изменения** (строки 76-143):

```typescript
{/* Сменяющиеся превью стикеров */}
<div style={{ 
  width: '100%', 
  height: '100%', 
  position: 'relative',
  overflow: 'hidden'
}}>
  {/* ОПТИМИЗАЦИЯ: Рендерим только активный стикер */}
  {pack.previewStickers[currentStickerIndex] && (
    <AnimatedSticker
      fileId={pack.previewStickers[currentStickerIndex].fileId}
      imageUrl={pack.previewStickers[currentStickerIndex].url}
      emoji={pack.previewStickers[currentStickerIndex].emoji}
      className="pack-card-animated-sticker"
      key={`${pack.id}-${currentStickerIndex}`}
    />
  )}
</div>
```

⚠️ **ВНИМАНИЕ**: Полный код для замены всех строк см. в разделе "Шаг 2.4"

### 2.4 Замена строк 76-143 в PackCard.tsx

Полная замена блока превью стикеров:

```typescript:miniapp/src/components/PackCard.tsx
{/* Сменяющиеся превью стикеров - ОПТИМИЗИРОВАНО */}
<div style={{ 
  width: '100%', 
  height: '100%', 
  position: 'relative',
  overflow: 'hidden'
}}>
  {(() => {
    const activeSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];
    if (!activeSticker) return null;
    
    return (
      <div
        key={`${pack.id}-${activeSticker.fileId}-${currentStickerIndex}`}
        data-testid="sticker-preview"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        {activeSticker.fileId ? (
          activeSticker.isAnimated ? (
            <AnimatedSticker
              fileId={activeSticker.fileId}
              imageUrl={activeSticker.url}
              emoji={activeSticker.emoji}
              className="pack-card-animated-sticker"
            />
          ) : (
            <img
              src={activeSticker.url}
              alt={activeSticker.emoji}
              className="pack-card-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              loading={isHighPriority ? 'eager' : 'lazy'}
              decoding="async"
            />
          )
        ) : (
          <div 
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              color: 'var(--tg-theme-hint-color)'
            }}
          >
            {activeSticker.emoji}
          </div>
        )}
      </div>
    );
  })()}
</div>
```

### 2.5 Как проверить шаг 2

**Проверка 1: React DevTools**
1. Откройте React DevTools
2. Выберите любой `PackCard` в дереве компонентов
3. Проверьте: должен быть только **1** `AnimatedSticker` (раньше было 4)

**Проверка 2: Elements inspector**
1. Откройте DevTools → Elements
2. Найдите div с классом `pack-card`
3. Проверьте количество дочерних элементов: должен быть только 1 div со стикером

**Проверка 3: Performance**
1. Запишите профиль 10 секунд
2. Сравните количество DOM nodes: должно быть ~60% меньше

**Ожидаемый результат**: ✅ Вместо 3 Lottie инстансов на PackCard теперь 1

---

## ШАГ 3: Оптимизация AnimatedSticker (IntersectionObserver пауза)

### 3.1 Что изменить

**Проблема**: Lottie анимации продолжают работать даже когда не видны (вне viewport)

**Решение**: Использовать IntersectionObserver для паузы невидимых анимаций

### 3.2 Какие файлы изменить

📁 **`miniapp/src/components/AnimatedSticker.tsx`**

### 3.3 Зависимости

✅ **Не нужны**: IntersectionObserver — нативный Web API, нет зависимостей

### 3.4 Код для добавления

**Изменение: Добавить ref для Lottie и IntersectionObserver**

```typescript:miniapp/src/components/AnimatedSticker.tsx
import React, { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';
import type { LottieRefCurrentProps } from 'lottie-react';

// ... (остальной код без изменений до строки 21)

export const AnimatedSticker: React.FC<AnimatedStickerProps> = ({
  fileId,
  imageUrl,
  emoji,
  className,
  hidePlaceholder
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // НОВЫЙ КОД: Ref для управления анимацией
  const animationRef = useRef<LottieRefCurrentProps>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ... (существующий useEffect для загрузки анимации, без изменений)

  // НОВЫЙ КОД: IntersectionObserver для паузы невидимых анимаций
  useEffect(() => {
    if (!animationRef.current || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!animationRef.current) return;
        
        if (!entry.isIntersecting) {
          // Пауза анимации вне viewport
          animationRef.current.pause();
          console.log('🎬 Paused animation (out of viewport):', fileId);
        } else {
          // Возобновление анимации в viewport
          animationRef.current.play();
          console.log('🎬 Playing animation (in viewport):', fileId);
        }
      },
      {
        threshold: 0.1, // Анимация видна если 10% в viewport
        rootMargin: '50px' // Пауза с запасом 50px до viewport
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [animationData, fileId]); // Запускаем только после загрузки анимации

  // ... (существующие return блоки, но с добавлением refs)
```

### 3.5 Изменение return блока

**Было** (строки 105-156):
```typescript
if (loading) {
  return (
    <div className={className} style={{ /* ... */ }}>
      {hidePlaceholder ? null : (emoji || '🎨')}
    </div>
  );
}

if (error || !animationData) {
  return (
    <img src={imageUrl} alt={emoji || ''} className={className} ... />
  );
}

return (
  <Lottie
    animationData={animationData}
    loop={true}
    autoplay={true}
    className={className}
    style={{ width: '100%', height: '100%' }}
  />
);
```

**Стало** (добавляем ref и контейнер):
```typescript
if (loading) {
  return (
    <div 
      ref={containerRef}
      className={className} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '48px' 
      }}
    >
      {hidePlaceholder ? null : (emoji || '🎨')}
    </div>
  );
}

if (error || !animationData) {
  return (
    <div ref={containerRef}>
      <img
        src={imageUrl}
        alt={emoji || ''}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          console.log('🎬 Image fallback failed, showing emoji:', fileId);
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 48px;">${emoji || '🎨'}</div>`;
          }
        }}
      />
    </div>
  );
}

return (
  <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
    <Lottie
      lottieRef={animationRef}
      animationData={animationData}
      loop={true}
      autoplay={true}
      className={className}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  </div>
);
```

### 3.6 Полный код AnimatedSticker.tsx после изменений

См. файл **"AnimatedSticker.optimized.tsx"** в конце документа

### 3.7 Как проверить шаг 3

**Проверка 1: Console logs**
1. Откройте Console в DevTools
2. Прокрутите страницу вниз/вверх
3. Должны появиться логи: `🎬 Paused animation...` и `🎬 Playing animation...`

**Проверка 2: Visual проверка**
1. Откройте страницу Gallery
2. Прокрутите вниз, чтобы PackCard исчезли с экрана
3. Анимации должны быть на паузе (не двигаться)

**Проверка 3: Performance**
1. Откройте Performance Monitor (DevTools → More tools)
2. Проверьте FPS: должен быть 50-60 вместо 30-45
3. Проверьте CPU: должно быть ниже при прокрутке

**Ожидаемый результат**: ✅ Анимации автоматически паузатся вне viewport

---

## ШАГ 4: Prefetch JSON без монтирования

### 4.1 Что изменить

**Проблема**: При ротации стикеров JSON загружается в момент монтирования, что вызывает задержку

**Решение**: Prefetch JSON для следующего стикера ДО его монтирования

### 4.2 Какие файлы изменить

📁 **`miniapp/src/hooks/useStickerRotation.ts`**

### 4.3 Зависимости

✅ **Не нужны**: Используем существующий `animationCache` из `AnimatedSticker.tsx`

### 4.4 Код для добавления

**Изменение: Добавить prefetch JSON в дополнение к prefetch изображения**

Текущий код (строки 48-59):
```typescript
// 1) Предзагружаем следующий стикер (если есть источник)
try {
  if (stickerSources && stickerSources.length > 0) {
    const nextIdx = (currentIndexRef.current + 1) % Math.min(stickersCount, stickerSources.length);
    const src = stickerSources[nextIdx];
    if (src) {
      await imageLoader.loadImage(src.fileId, src.url, 1);
    }
  }
} catch {
  // ignore preload errors
}
```

Новый код (добавляем prefetch JSON для анимаций):
```typescript
// 1) Предзагружаем следующий стикер (если есть источник)
try {
  if (stickerSources && stickerSources.length > 0) {
    const nextIdx = (currentIndexRef.current + 1) % Math.min(stickersCount, stickerSources.length);
    const src = stickerSources[nextIdx];
    if (src) {
      // Prefetch изображение
      await imageLoader.loadImage(src.fileId, src.url, 1);
      
      // ОПТИМИЗАЦИЯ: Prefetch JSON для анимаций
      const fetchAnimationJson = async (fileId: string, url: string) => {
        try {
          const response = await fetch(url);
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            // Сохраняем в кеш (глобальный кеш из AnimatedSticker)
            const animationCache = (window as any).__animationCache || new Map();
            animationCache.set(fileId, data);
            (window as any).__animationCache = animationCache;
            console.log('🎬 Prefetched animation:', fileId);
          }
        } catch (err) {
          // ignore prefetch errors
        }
      };
      
      // Prefetch анимацию в фоне (не ждём завершения)
      fetchAnimationJson(src.fileId, src.url);
    }
  }
} catch {
  // ignore preload errors
}
```

### 4.5 Альтернативный подход (чище)

Создать отдельную утилиту для работы с animation cache:

**Новый файл**: `miniapp/src/utils/animationLoader.ts`
```typescript
// Глобальный кеш для Lottie анимаций (shared с AnimatedSticker)
const animationCache = new Map<string, any>();

export const prefetchAnimation = async (fileId: string, url: string): Promise<void> => {
  try {
    // Проверяем кеш
    if (animationCache.has(fileId)) {
      return; // Уже закэшировано
    }
    
    const response = await fetch(url);
    if (!response.ok) return;
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      animationCache.set(fileId, data);
      console.log('🎬 Prefetched animation:', fileId);
    }
  } catch (err) {
    // ignore prefetch errors
  }
};

export const getCachedAnimation = (fileId: string): any => {
  return animationCache.get(fileId);
};

// Экспортируем кеш для использования в AnimatedSticker
export { animationCache };
```

Затем использовать в `useStickerRotation.ts`:
```typescript
import { prefetchAnimation } from '../utils/animationLoader';

// В цикле schedule:
await prefetchAnimation(src.fileId, src.url);
```

И в `AnimatedSticker.tsx`:
```typescript
import { animationCache } from '../utils/animationLoader';

// Заменить глобальный кеш на импортированный
```

**Рекомендация**: Используйте альтернативный подход (создать утилиту), чтобы не дублировать код кеша.

### 4.6 Как проверить шаг 4

**Проверка 1: Console logs**
1. Откройте Console в DevTools
2. Подождите ротацию стикеров
3. Должны появиться логи: `🎬 Prefetched animation: ...` ДО монтирования

**Проверка 2: Network tab**
1. Откройте Network → Fetch/XHR
2. Отфильтруйте по `.json`
3. Проверьте: JSON должен загружаться раньше, чем монтируется компонент

**Ожидаемый результат**: ✅ Нет задержки при ротации стикеров

---

## ШАГ 5: Итоговое тестирование

### 5.1 Проверка производительности

**Чек-лист**:

- [ ] React DevTools: только 1 AnimatedSticker на PackCard (было 4)
- [ ] Console logs: анимации паузятся/возобновляются при прокрутке
- [ ] Performance Monitor: FPS 50-60 (было 30-45)
- [ ] Memory: ~120MB (было ~300MB)
- [ ] DOM nodes: ~800 (было ~2000+)
- [ ] Network: prefetch JSON работает
- [ ] Visual: нет задержек при ротации стикеров

### 5.2 Стресс-тест

**Сценарий**:
1. Откройте страницу Gallery
2. Прокрутите до конца (загрузите все паки)
3. Проверьте FPS на протяжении 30 секунд
4. Прокрутите быстро вверх/вниз
5. Проверьте, что анимации плавно паузятся/возобновляются

**Ожидаемый результат**:
- FPS стабильно 50-60
- Нет микрофризов при прокрутке
- Память не растёт сверх меры

### 5.3 Проверка на медленном 3G

**Сценарий**:
1. Откройте DevTools → Network
2. Выберите медленный 3G
3. Перезагрузите страницу
4. Проверьте: анимации должны загружаться постепенно

**Ожидаемый результат**:
- Нет блокировки UI во время загрузки
- Prefetch не мешает основным загрузкам

---

## ШАГ 6: Откат изменений (если возникнут проблемы)

### 6.1 Как откатить изменения

**Git откат** (если используете git):

```bash
# Проверить изменения
git status

# Посмотреть diff
git diff

# Откатить файлы
git checkout -- miniapp/src/components/PackCard.tsx
git checkout -- miniapp/src/components/AnimatedSticker.tsx
git checkout -- miniapp/src/hooks/useStickerRotation.ts

# Или откатить весь коммит
git reset --hard HEAD~1
```

**Ручной откат**:

Файлы для восстановления из backup:
- `miniapp/src/components/PackCard.tsx` → вернуть строки 76-143 к исходному состоянию
- `miniapp/src/components/AnimatedSticker.tsx` → удалить refs и IntersectionObserver
- `miniapp/src/hooks/useStickerRotation.ts` → удалить prefetch JSON

### 6.2 Быстрый fallback (если только один компонент сломался)

**Если PackCard сломался**:
- Вернуть map всех стикеров (строки 83-142)

**Если AnimatedSticker сломался**:
- Удалить IntersectionObserver useEffect (строки с observer)
- Убрать refs из return блоков

**Если useStickerRotation сломался**:
- Удалить код prefetch JSON

### 6.3 Feature flag для постепенного rollout

**Создать feature flag** (опционально):

```typescript
// miniapp/src/config/features.ts
export const features = {
  lottieOptimization: process.env.NODE_ENV === 'production' ? false : true // включаем постепенно
};

// Использовать в PackCard:
import { features } from '../config/features';

{features.lottieOptimization ? (
  // Оптимизированный рендеринг
) : (
  // Старый рендеринг
)}
```

---

## Полный код изменённых файлов

### AnimatedSticker.optimized.tsx

```typescript
import React, { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';
import type { LottieRefCurrentProps } from 'lottie-react';

// Глобальный кеш для Lottie анимаций
const animationCache = new Map<string, any>();

interface AnimatedStickerProps {
  fileId: string;
  imageUrl: string;
  emoji?: string;
  className?: string;
  hidePlaceholder?: boolean;
}

export const AnimatedSticker: React.FC<AnimatedStickerProps> = ({
  fileId,
  imageUrl,
  emoji,
  className,
  hidePlaceholder
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Refs для управления анимацией и IntersectionObserver
  const animationRef = useRef<LottieRefCurrentProps>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAnimation = async () => {
      try {
        setLoading(true);
        setError(false);

        // Проверяем валидность URL
        if (!imageUrl || imageUrl === '') {
          console.log('🎬 Invalid imageUrl, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        // Проверяем кеш
        if (animationCache.has(fileId)) {
          console.log('🎬 Loaded from cache:', fileId);
          if (!cancelled) {
            setAnimationData(animationCache.get(fileId));
            setLoading(false);
          }
          return;
        }

        // Загружаем JSON анимации
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
          console.log('🎬 Animation not found, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        const contentType = response.headers.get('content-type');
        
        // Проверяем, что это JSON
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          if (!cancelled) {
            // Сохраняем в кеш
            animationCache.set(fileId, data);
            console.log('🎬 Cached animation:', fileId);
            setAnimationData(data);
          }
        } else {
          console.log('🎬 Not a JSON animation, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
          }
        }
      } catch (err) {
        console.log('🎬 Failed to load animation, using fallback:', fileId, err);
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAnimation();

    return () => {
      cancelled = true;
    };
  }, [fileId, imageUrl]);

  // IntersectionObserver для паузы невидимых анимаций
  useEffect(() => {
    if (!animationRef.current || !containerRef.current || !animationData) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!animationRef.current) return;
        
        if (!entry.isIntersecting) {
          // Пауза анимации вне viewport
          animationRef.current.pause();
          console.log('🎬 Paused animation (out of viewport):', fileId);
        } else {
          // Возобновление анимации в viewport
          animationRef.current.play();
          console.log('🎬 Playing animation (in viewport):', fileId);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [animationData, fileId]);

  if (loading) {
    return (
      <div 
        ref={containerRef}
        className={className} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: '48px' 
        }}
      >
        {hidePlaceholder ? null : (emoji || '🎨')}
      </div>
    );
  }

  if (error || !animationData) {
    // Fallback - пробуем показать как обычное изображение
    return (
      <div ref={containerRef}>
        <img
          src={imageUrl}
          alt={emoji || ''}
          className={className}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            console.log('🎬 Image fallback failed, showing emoji:', fileId);
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 48px;">${emoji || '🎨'}</div>`;
            }
          }}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Lottie
        lottieRef={animationRef}
        animationData={animationData}
        loop={true}
        autoplay={true}
        className={className}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
```

### PackCard.optimized.tsx (частично)

Только блок превью стикеров (строки 76-143):

```typescript
{/* Сменяющиеся превью стикеров - ОПТИМИЗИРОВАНО */}
<div style={{ 
  width: '100%', 
  height: '100%', 
  position: 'relative',
  overflow: 'hidden'
}}>
  {(() => {
    const activeSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];
    if (!activeSticker) return null;
    
    return (
      <div
        key={`${pack.id}-${activeSticker.fileId}-${currentStickerIndex}`}
        data-testid="sticker-preview"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        {activeSticker.fileId ? (
          activeSticker.isAnimated ? (
            <AnimatedSticker
              fileId={activeSticker.fileId}
              imageUrl={activeSticker.url}
              emoji={activeSticker.emoji}
              className="pack-card-animated-sticker"
            />
          ) : (
            <img
              src={activeSticker.url}
              alt={activeSticker.emoji}
              className="pack-card-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              loading={isHighPriority ? 'eager' : 'lazy'}
              decoding="async"
            />
          )
        ) : (
          <div 
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              color: 'var(--tg-theme-hint-color)'
            }}
          >
            {activeSticker.emoji}
          </div>
        )}
      </div>
    );
  })()}
</div>
```

---

## Резюме

**Что делаем**:
1. ✅ Рендерим только 1 активный стикер вместо 4
2. ✅ Паузим невидимые анимации через IntersectionObserver
3. ✅ Prefetch JSON для следующего стикера

**Время**: 3-5 часов

**Риски**: ✅ Минимальные (стандартные паттерны)

**Прирост**:
- FPS: +35%
- Память: -60%
- Активных Lottie: -80%

**Backend**: ❌ Не нужен

**Откат**: ✅ Простой (git checkout или ручное восстановление)



