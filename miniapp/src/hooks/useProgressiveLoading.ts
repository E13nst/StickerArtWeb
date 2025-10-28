import { useState, useEffect, useCallback, useRef } from 'react';
import { imageLoader, LoadPriority } from '../utils/imageLoader';

interface ProgressiveLoadingState {
  loadedImages: string[];
  currentImageIndex: number;
  isLoading: boolean;
  isFirstImageLoaded: boolean;
  hasError: boolean;
}

interface ProgressiveLoadingOptions {
  packId: string;
  selectedPosters: Array<{ fileId: string; url: string; isAnimated?: boolean; emoji?: string }>;
  isHighPriority?: boolean;
  isVisible?: boolean;
  onImageLoaded?: (imageUrl: string, index: number) => void;
  onAllImagesLoaded?: () => void;
}

export const useProgressiveLoading = ({
  packId,
  selectedPosters,
  isHighPriority = false,
  isVisible = true,
  onImageLoaded,
  onAllImagesLoaded
}: ProgressiveLoadingOptions) => {
  // Проверяем, что selectedPosters существует и является массивом
  const safeSelectedPosters = selectedPosters || [];
  
  // Разделенное состояние для лучшей производительности
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstImageLoaded, setIsFirstImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const loadingRef = useRef<{
    currentIndex: number;
    isProcessing: boolean;
    abortController: AbortController | null;
  }>({
    currentIndex: 0,
    isProcessing: false,
    abortController: null
  });

  // Batch-загрузка первых изображений параллельно
  const loadFirstBatchOptimized = useCallback(async () => {
    if (safeSelectedPosters.length === 0 || isFirstImageLoaded) return;

    setIsLoading(true);
    setHasError(false);

    try {
      // Загружаем первые 3-6 изображений параллельно в зависимости от приоритета
      const batchSize = isHighPriority ? 6 : 3;
      const batch = safeSelectedPosters.slice(0, Math.min(batchSize, safeSelectedPosters.length));
      
      console.log(`🚀 Loading ${batch.length} images in parallel for pack ${packId}`);

      // Параллельная загрузка всех изображений в батче
      const promises = batch.map((poster, index) => 
        imageLoader.loadImage(
          poster.fileId,
          poster.url,
          isHighPriority ? LoadPriority.TIER_1_FIRST_6_PACKS : LoadPriority.TIER_2_FIRST_IMAGE,
          packId,
          index
        ).catch(err => {
          console.warn(`Failed to load image ${index} for pack ${packId}:`, err);
          return null;
        })
      );

      const results = await Promise.allSettled(promises);
      const loadedUrls = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (loadedUrls.length > 0) {
        setLoadedImages(loadedUrls);
        setIsFirstImageLoaded(true);
        
        loadedUrls.forEach((url, index) => {
          onImageLoaded?.(url, index);
        });

        console.log(`✅ Loaded ${loadedUrls.length}/${batch.length} images for pack ${packId}`);
      } else {
        setHasError(true);
      }
    } catch (error) {
      console.warn('Failed to load first batch:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [packId, safeSelectedPosters, isHighPriority, onImageLoaded, isFirstImageLoaded]);

  // Загрузка остальных изображений батчами
  const loadRemainingImages = useCallback(async () => {
    if (loadingRef.current.isProcessing || !isFirstImageLoaded) {
      return;
    }

    const remainingCount = safeSelectedPosters.length - loadedImages.length;
    if (remainingCount <= 0) {
      return;
    }

    loadingRef.current.isProcessing = true;

    try {
      // Загружаем оставшиеся изображения батчами по 3
      const batchSize = 3;
      const startIndex = loadedImages.length;
      const batch = safeSelectedPosters.slice(startIndex, startIndex + batchSize);

      console.log(`🔄 Loading batch of ${batch.length} images for pack ${packId} (${startIndex}-${startIndex + batch.length})`);

      const promises = batch.map((poster, i) => {
        const index = startIndex + i;
        return imageLoader.loadImage(
          poster.fileId,
          poster.url,
          isHighPriority ? LoadPriority.TIER_3_ADDITIONAL : LoadPriority.TIER_4_BACKGROUND,
          packId,
          index
        ).catch(err => {
          console.warn(`Failed to load image ${index} for pack ${packId}:`, err);
          return null;
        });
      });

      const results = await Promise.allSettled(promises);
      const loadedUrls = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (loadedUrls.length > 0) {
        setLoadedImages(prev => [...prev, ...loadedUrls]);

        loadedUrls.forEach((url, i) => {
          onImageLoaded?.(url, startIndex + i);
        });

        console.log(`✅ Loaded batch: ${loadedUrls.length}/${batch.length} images for pack ${packId}`);
      }

      // Проверить, загружены ли все изображения
      const totalLoaded = loadedImages.length + loadedUrls.length;
      if (totalLoaded >= safeSelectedPosters.length) {
        onAllImagesLoaded?.();
        console.log(`🎉 All images loaded for pack ${packId}`);
      }
    } catch (error) {
      console.warn('Failed to load remaining images:', error);
    } finally {
      loadingRef.current.isProcessing = false;
    }
  }, [packId, safeSelectedPosters, loadedImages.length, isHighPriority, isFirstImageLoaded, onImageLoaded, onAllImagesLoaded]);

  // Автоматическая загрузка остальных изображений батчами с минимальной задержкой
  useEffect(() => {
    if (!isVisible || !isFirstImageLoaded || loadingRef.current.isProcessing) {
      return;
    }

    // Проверяем, есть ли еще изображения для загрузки
    if (loadedImages.length >= safeSelectedPosters.length) {
      return;
    }

    // Минимальная задержка для плавности UI (можно убрать совсем)
    const timer = setTimeout(() => {
      loadRemainingImages();
    }, isHighPriority ? 100 : 200);

    return () => clearTimeout(timer);
  }, [isVisible, isFirstImageLoaded, loadedImages.length, loadRemainingImages, isHighPriority, safeSelectedPosters.length]);

  // Запуск загрузки первого батча изображений
  useEffect(() => {
    if (isVisible && !isFirstImageLoaded && !isLoading && safeSelectedPosters.length > 0) {
      loadFirstBatchOptimized();
    }
  }, [isVisible, isFirstImageLoaded, isLoading, loadFirstBatchOptimized, safeSelectedPosters.length]);

  // Слайдшоу - переключение между изображениями с оптимизацией
  useEffect(() => {
    if (loadedImages.length < 2) return;

    const interval = setInterval(() => {
      setCurrentImageIndex(prev => {
        const newIndex = (prev + 1) % loadedImages.length;
        // Проверяем, действительно ли изменился индекс
        if (prev !== newIndex) {
          return newIndex;
        }
        return prev;
      });
    }, 4000); // Фиксированный интервал для предсказуемости

    return () => clearInterval(interval);
  }, [loadedImages.length]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (loadingRef.current.abortController) {
        loadingRef.current.abortController.abort();
      }
    };
  }, []);

  // Ручная загрузка следующего батча изображений
  const loadNextImageManually = useCallback(() => {
    if (!loadingRef.current.isProcessing) {
      loadRemainingImages();
    }
  }, [loadRemainingImages]);

  // Сброс состояния
  const reset = useCallback(() => {
    setLoadedImages(prev => {
      if (prev.length > 0) {
        return [];
      }
      return prev;
    });
    setCurrentImageIndex(prev => {
      if (prev !== 0) {
        return 0;
      }
      return prev;
    });
    setIsLoading(prev => {
      if (prev) {
        return false;
      }
      return prev;
    });
    setIsFirstImageLoaded(prev => {
      if (prev) {
        return false;
      }
      return prev;
    });
    setHasError(prev => {
      if (prev) {
        return false;
      }
      return prev;
    });
    loadingRef.current = {
      currentIndex: 0,
      isProcessing: false,
      abortController: null
    };
  }, []);

  return {
    loadedImages,
    currentImageIndex,
    isLoading,
    isFirstImageLoaded,
    hasError,
    shouldShowSlideshow: loadedImages.length > 1,
    loadNextImageManually,
    reset,
    canLoadMore: loadedImages.length < safeSelectedPosters.length,
    totalImages: safeSelectedPosters.length,
    progress: safeSelectedPosters.length > 0 ? (loadedImages.length / safeSelectedPosters.length) * 100 : 0
  };
};



