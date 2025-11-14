import { imageCache } from './galleryUtils';
import { imageLoader, LoadPriority } from './imageLoader';

// Глобальный кеш для Lottie анимаций (shared с AnimatedSticker)
const animationCache = new Map<string, any>();
// Глобальный Set для отслеживания стикеров из галереи (для очистки кеша после модального окна)
const galleryAnimationIds = new Set<string>();
const animationPrefetchInFlight = new Map<string, Promise<void>>();

const stickerBlobCache = new Map<string, string>();
const stickerBlobType = new Map<string, 'image' | 'video'>();
const galleryStickerBlobIds = new Set<string>();
const stickerPrefetchInFlight = new Map<string, Promise<void>>();

export const getCachedStickerUrl = (fileId: string): string | undefined => {
  return stickerBlobCache.get(fileId);
};

export const getCachedStickerMediaType = (fileId: string): 'image' | 'video' | undefined => {
  return stickerBlobType.get(fileId);
};

export const markAsGallerySticker = (fileId: string): void => {
  galleryStickerBlobIds.add(fileId);
};

const setStickerBlob = (fileId: string, objectUrl: string, type: 'image' | 'video') => {
  const existing = stickerBlobCache.get(fileId);
  if (existing && existing !== objectUrl) {
    URL.revokeObjectURL(existing);
  }
  stickerBlobCache.set(fileId, objectUrl);
  stickerBlobType.set(fileId, type);
};

const revokeStickerBlob = (fileId: string) => {
  const existing = stickerBlobCache.get(fileId);
  if (existing) {
    URL.revokeObjectURL(existing);
  }
  stickerBlobCache.delete(fileId);
  stickerBlobType.delete(fileId);
  galleryStickerBlobIds.delete(fileId);
};

export const prefetchAnimation = async (fileId: string, url: string): Promise<void> => {
  if (animationCache.has(fileId)) {
    return;
  }

  const existing = animationPrefetchInFlight.get(fileId);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    try {
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
    } finally {
      animationPrefetchInFlight.delete(fileId);
    }
  })();

  animationPrefetchInFlight.set(fileId, task);
  return task;
};

export const prefetchSticker = async (
  fileId: string,
  url: string,
  options: { 
    isAnimated?: boolean; 
    isVideo?: boolean; 
    markForGallery?: boolean;
    priority?: LoadPriority; // Приоритет загрузки через imageLoader
  } = {}
): Promise<void> => {
  const { 
    isAnimated = false, 
    isVideo = false, 
    markForGallery = false,
    priority = LoadPriority.TIER_4_BACKGROUND // По умолчанию низкий приоритет
  } = options;

  if (markForGallery) {
    markAsGallerySticker(fileId);
  }

  // Для анимаций используем prefetchAnimation (загружает JSON)
  if (isAnimated) {
    return prefetchAnimation(fileId, url);
  }

  // Для обычных изображений используем imageLoader с приоритетами
  if (!isVideo) {
    // Проверяем кеш imageLoader (он уже может быть загружен)
    const cached = imageCache.get(fileId);
    if (cached) {
      // Если есть в кеше imageLoader, сохраняем в stickerBlobCache для совместимости
      if (!stickerBlobCache.has(fileId)) {
        setStickerBlob(fileId, cached, 'image');
      }
      return;
    }

    // Используем imageLoader с указанным приоритетом
    try {
      const loadedUrl = await imageLoader.loadImage(fileId, url, priority);
      // Сохраняем в stickerBlobCache для совместимости со старым кодом
      if (!stickerBlobCache.has(fileId)) {
        setStickerBlob(fileId, loadedUrl, 'image');
      }
    } catch (error) {
      // Игнорируем ошибки загрузки
      if ((import.meta as any).env?.DEV) {
        console.warn(`Failed to prefetch sticker ${fileId}:`, error);
      }
    }
    return;
  }

  // Для видео используем старую логику (blob)
  if (stickerBlobCache.has(fileId)) {
    return;
  }

  if (stickerPrefetchInFlight.has(fileId)) {
    return stickerPrefetchInFlight.get(fileId)!;
  }

  const task = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const type = response.headers.get('content-type')?.includes('video') ? 'video' : 'image';
      setStickerBlob(fileId, objectUrl, type);
      if (type === 'image') {
        imageCache.set(fileId, objectUrl);
      }
    } catch {
      // ignore errors
    } finally {
      stickerPrefetchInFlight.delete(fileId);
    }
  })();

  stickerPrefetchInFlight.set(fileId, task);
  return task;
};

export const getCachedAnimation = (fileId: string): any => {
  return animationCache.get(fileId);
};

export const markAsGalleryAnimation = (fileId: string): void => {
  galleryAnimationIds.add(fileId);
};

export const clearNonGalleryAnimations = (): void => {
  let clearedAnimations = 0;
  for (const fileId of animationCache.keys()) {
    if (!galleryAnimationIds.has(fileId)) {
      animationCache.delete(fileId);
      clearedAnimations++;
    }
  }
  if (clearedAnimations > 0) {
    console.log(`🧹 Cleared ${clearedAnimations} non-gallery animations from cache`);
  }
  animationPrefetchInFlight.clear();

  let clearedBlobs = 0;
  for (const fileId of stickerBlobCache.keys()) {
    if (!galleryStickerBlobIds.has(fileId)) {
      revokeStickerBlob(fileId);
      clearedBlobs++;
    }
  }
  if (clearedBlobs > 0) {
    console.log(`🧹 Cleared ${clearedBlobs} sticker media blobs from cache`);
  }
  stickerPrefetchInFlight.clear();
};

export const clearStickerBlobsExcept = (preserveIds: Set<string>): void => {
  for (const fileId of stickerBlobCache.keys()) {
    if (!preserveIds.has(fileId)) {
      revokeStickerBlob(fileId);
    }
  }
  stickerPrefetchInFlight.clear();
};

export { animationCache };

