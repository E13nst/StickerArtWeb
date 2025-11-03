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

