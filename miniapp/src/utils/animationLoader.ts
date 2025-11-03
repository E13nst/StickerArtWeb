// Глобальный кеш для Lottie анимаций (shared с AnimatedSticker)
const animationCache = new Map<string, any>();

// Глобальный Set для отслеживания стикеров из галереи (для очистки кеша после модального окна)
const galleryAnimationIds = new Set<string>();

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

// Универсальная предзагрузка стикера - определяет тип и сохраняет в нужный кеш
export const prefetchSticker = async (fileId: string, url: string): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    
    const contentType = response.headers.get('content-type') || '';
    
    // JSON (Lottie) - сохраняем в animationCache
    if (contentType.includes('application/json')) {
      const data = await response.json();
      animationCache.set(fileId, data);
      console.log('🎬 Prefetched JSON sticker:', fileId);
    } 
    // Изображение (WebP, PNG, GIF) - предзагружаем через Image для кеша браузера
    else if (contentType.includes('image/')) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          console.log('🖼️ Prefetched image sticker:', fileId);
          resolve();
        };
        img.onerror = () => resolve(); // ignore errors
        img.src = url;
      });
    }
  } catch (err) {
    // ignore prefetch errors
  }
};

export const getCachedAnimation = (fileId: string): any => {
  return animationCache.get(fileId);
};

// Отметить анимацию как из галереи (не удалять при очистке)
export const markAsGalleryAnimation = (fileId: string): void => {
  galleryAnimationIds.add(fileId);
};

// Очистить кеш анимаций, оставив только стикеры из галереи
export const clearNonGalleryAnimations = (): void => {
  let clearedCount = 0;
  for (const fileId of animationCache.keys()) {
    if (!galleryAnimationIds.has(fileId)) {
      animationCache.delete(fileId);
      clearedCount++;
    }
  }
  if (clearedCount > 0) {
    console.log(`🧹 Cleared ${clearedCount} non-gallery animations from cache`);
  }
};

// Экспортируем кеш для использования в AnimatedSticker
export { animationCache };

