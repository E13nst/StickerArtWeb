import { useState, useEffect, useCallback, useRef } from 'react';
import { imageLoader, LoadPriority, imageCache, videoBlobCache, animationCache } from '@/utils/imageLoader';
import { getStickerImageUrl } from '@/utils/stickerUtils';
import { Sticker } from '@/types/sticker';

interface UseStickerLoadQueueOptions {
  stickers: Sticker[];
  packId: string;
  initialLoad?: number;      // По умолчанию 5
  loadOnScroll?: number;     // По умолчанию 2
  enabled?: boolean;         // По умолчанию true
}

interface UseStickerLoadQueueReturn {
  loadedIndices: Set<number>;
  isLoaded: (index: number) => boolean;
  triggerLoad: () => void;   // Вызывается при навигации
  clearQueue: () => void;    // Вызывается при свайпе
  pendingCount: number;
}

/**
 * Хук для управления очередью загрузки стикеров
 * - Загружает первые initialLoad стикеров при монтировании
 * - Догружает loadOnScroll стикеров при вызове triggerLoad
 * - Очищает pending очередь при вызове clearQueue
 */
export const useStickerLoadQueue = ({
  stickers,
  packId,
  initialLoad = 5,
  loadOnScroll = 2,
  enabled = true
}: UseStickerLoadQueueOptions): UseStickerLoadQueueReturn => {
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set());
  const queueRef = useRef<number[]>([]); // Очередь индексов для загрузки
  const loadingRef = useRef<Set<number>>(new Set()); // Активные загрузки
  const hasInitializedRef = useRef(false);
  const packIdRef = useRef<string>(packId);

  /**
   * Проверяет, загружен ли стикер (в кеше или в процессе загрузки)
   */
  const isStickerLoaded = useCallback((index: number): boolean => {
    if (index < 0 || index >= stickers.length) return false;
    
    const sticker = stickers[index];
    if (!sticker) return false;

    // Проверяем кеш
    const hasInCache = imageCache.has(sticker.file_id) || 
                       videoBlobCache.has(sticker.file_id) || 
                       animationCache.has(sticker.file_id);

    if (hasInCache) return true;

    // Проверяем, загружается ли сейчас
    if (loadingRef.current.has(index)) return true;

    return loadedIndices.has(index);
  }, [stickers, loadedIndices]);

  /**
   * Загружает стикер в очередь
   */
  const loadSticker = useCallback(async (index: number): Promise<void> => {
    if (index < 0 || index >= stickers.length) return;
    if (loadedIndices.has(index) || loadingRef.current.has(index)) return;

    const sticker = stickers[index];
    if (!sticker) return;

    loadingRef.current.add(index);

    try {
      const imageUrl = getStickerImageUrl(sticker.file_id);
      const isAnimated = sticker.is_animated || false;
      const isVideo = sticker.is_video || false;

      // Определяем приоритет: первый стикер - максимальный, остальные - средний
      const priority = index === 0 
        ? LoadPriority.TIER_1_VIEWPORT 
        : LoadPriority.TIER_2_NEAR_VIEWPORT;

      // Загружаем через imageLoader с правильным типом ресурса
      if (isVideo) {
        await imageLoader.loadVideo(sticker.file_id, imageUrl, priority, packId, index);
      } else if (isAnimated) {
        await imageLoader.loadAnimation(sticker.file_id, imageUrl, priority, packId, index);
      } else {
        await imageLoader.loadImage(sticker.file_id, imageUrl, priority, packId, index);
      }

      // Помечаем как загруженный
      setLoadedIndices(prev => new Set([...prev, index]));
    } catch (error) {
      console.warn(`Failed to load sticker ${index} for pack ${packId}:`, error);
    } finally {
      loadingRef.current.delete(index);
    }
  }, [stickers, packId, loadedIndices]);

  /**
   * Инициализация: загружает первые initialLoad стикеров
   * Сбрасывается при смене packId
   */
  useEffect(() => {
    // Если packId изменился, сбрасываем состояние
    if (packIdRef.current !== packId) {
      hasInitializedRef.current = false;
      setLoadedIndices(new Set());
      queueRef.current = [];
      loadingRef.current.clear();
      packIdRef.current = packId;
    }

    if (!enabled || !stickers.length || hasInitializedRef.current) return;

    hasInitializedRef.current = true;

    // Создаем очередь для начальной загрузки
    const initialIndices = Array.from({ length: Math.min(initialLoad, stickers.length) }, (_, i) => i);
    
    // Загружаем параллельно
    Promise.all(initialIndices.map(index => loadSticker(index))).catch(error => {
      console.warn(`Failed to load initial stickers for pack ${packId}:`, error);
    });

    // Оставшиеся стикеры добавляем в очередь
    const remainingIndices = Array.from(
      { length: Math.max(0, stickers.length - initialLoad) }, 
      (_, i) => i + initialLoad
    );
    queueRef.current = remainingIndices;
  }, [enabled, stickers.length, initialLoad, packId, loadSticker]);

  /**
   * Догружает loadOnScroll стикеров из очереди
   */
  const triggerLoad = useCallback(() => {
    if (!enabled || queueRef.current.length === 0) return;

    const indicesToLoad = queueRef.current.splice(0, loadOnScroll);
    
    // Загружаем параллельно
    Promise.all(indicesToLoad.map(index => loadSticker(index))).catch(error => {
      console.warn(`Failed to load additional stickers for pack ${packId}:`, error);
    });
  }, [enabled, loadOnScroll, packId, loadSticker]);

  /**
   * Очищает pending очередь (вызывается при свайпе)
   */
  const clearQueue = useCallback(() => {
    // Отменяем все активные загрузки из очереди
    queueRef.current.forEach(index => {
      const sticker = stickers[index];
      if (sticker) {
        imageLoader.abort(sticker.file_id);
      }
    });

    // Очищаем очередь
    queueRef.current = [];
  }, [stickers]);

  /**
   * Проверка загруженности стикера (публичный метод)
   */
  const isLoaded = useCallback((index: number): boolean => {
    return isStickerLoaded(index);
  }, [isStickerLoaded]);

  return {
    loadedIndices,
    isLoaded,
    triggerLoad,
    clearQueue,
    pendingCount: queueRef.current.length
  };
};
