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

  // Оптимизированная загрузка первого изображения
  const loadFirstImageOptimized = useCallback(async () => {
    if (safeSelectedPosters.length === 0 || isFirstImageLoaded) return;
    
    const firstPoster = safeSelectedPosters[0];
    if (!firstPoster) return;

    setIsLoading(prev => {
      if (!prev) {
        return true;
      }
      return prev;
    });
    setHasError(prev => {
      if (prev) {
        return false;
      }
      return prev;
    });

    try {
      const priority = isHighPriority ? LoadPriority.TIER_2_FIRST_IMAGE : LoadPriority.TIER_3_ADDITIONAL;
      const imageUrl = await imageLoader.loadImage(
        firstPoster.fileId,
        firstPoster.url,
        priority,
        packId,
        0
      );

      setLoadedImages(prev => {
        // Проверяем, не загружено ли уже это изображение
        if (prev.includes(imageUrl)) {
          return prev;
        }
        return [imageUrl];
      });
      setIsFirstImageLoaded(prev => {
        if (!prev) {
          return true;
        }
        return prev;
      });
      setIsLoading(prev => {
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

      onImageLoaded?.(imageUrl, 0);
      console.log(`🎨 First image loaded for pack ${packId}:`, imageUrl);
    } catch (error) {
      console.warn('Failed to load first image:', error);
      setIsLoading(prev => {
        if (prev) {
          return false;
        }
        return prev;
      });
      setHasError(prev => {
        if (!prev) {
          return true;
        }
        return prev;
      });
    }
  }, [packId, safeSelectedPosters, isHighPriority, onImageLoaded, isFirstImageLoaded]);

  // Прогрессивная загрузка остальных изображений
  const loadNextImage = useCallback(async () => {
    if (loadingRef.current.isProcessing || safeSelectedPosters.length <= loadedImages.length) {
      return;
    }

    const nextIndex = loadedImages.length;
    const nextPoster = safeSelectedPosters[nextIndex];
    if (!nextPoster) return;

    loadingRef.current.isProcessing = true;
    loadingRef.current.currentIndex = nextIndex;

    try {
      const priority = isHighPriority ? LoadPriority.TIER_3_ADDITIONAL : LoadPriority.TIER_4_BACKGROUND;
      const imageUrl = await imageLoader.loadImage(
        nextPoster.fileId,
        nextPoster.url,
        priority,
        packId,
        nextIndex
      );

      setLoadedImages(prev => {
        // Проверяем, не загружено ли уже это изображение
        if (prev.includes(imageUrl)) {
          return prev;
        }
        return [...prev, imageUrl];
      });

      onImageLoaded?.(imageUrl, nextIndex);
      console.log(`✅ Additional image ${nextIndex + 1} loaded for pack ${packId}:`, imageUrl);

      // Проверить, загружены ли все изображения
      if (loadedImages.length + 1 >= safeSelectedPosters.length) {
        onAllImagesLoaded?.();
        console.log(`🎉 All images loaded for pack ${packId}`);
      }
    } catch (error) {
      console.warn(`Failed to load image ${nextIndex + 1}:`, error);
    } finally {
      loadingRef.current.isProcessing = false;
    }
  }, [packId, safeSelectedPosters, loadedImages.length, isHighPriority, onImageLoaded, onAllImagesLoaded]);

  // Автоматическая загрузка следующего изображения с оптимизированными задержками
  useEffect(() => {
    if (!isVisible || !isFirstImageLoaded || loadingRef.current.isProcessing) {
      return;
    }

    // Проверяем, есть ли еще изображения для загрузки
    if (loadedImages.length >= safeSelectedPosters.length) {
      return;
    }

    // Фиксированные задержки для предсказуемости
    const timer = setTimeout(() => {
      loadNextImage();
    }, isHighPriority ? 300 : 800);

    return () => clearTimeout(timer);
  }, [isVisible, isFirstImageLoaded, loadedImages.length, loadNextImage, isHighPriority, safeSelectedPosters.length]);

  // Запуск загрузки первого изображения
  useEffect(() => {
    if (isVisible && !isFirstImageLoaded && !isLoading && safeSelectedPosters.length > 0) {
      loadFirstImageOptimized();
    }
  }, [isVisible, isFirstImageLoaded, isLoading, loadFirstImageOptimized, safeSelectedPosters.length]);

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

  // Ручная загрузка следующего изображения
  const loadNextImageManually = useCallback(() => {
    if (!loadingRef.current.isProcessing) {
      loadNextImage();
    }
  }, [loadNextImage]);

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



