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
  const [state, setState] = useState<ProgressiveLoadingState>({
    loadedImages: [],
    currentImageIndex: 0,
    isLoading: false,
    isFirstImageLoaded: false,
    hasError: false
  });

  const loadingRef = useRef<{
    currentIndex: number;
    isProcessing: boolean;
    abortController: AbortController | null;
  }>({
    currentIndex: 0,
    isProcessing: false,
    abortController: null
  });

  // Загрузка первого изображения
  const loadFirstImage = useCallback(async () => {
    if (selectedPosters.length === 0 || state.isFirstImageLoaded) return;

    const firstPoster = selectedPosters[0];
    if (!firstPoster) return;

    setState(prev => ({ ...prev, isLoading: true, hasError: false }));

    try {
      const priority = isHighPriority ? LoadPriority.TIER_2_FIRST_IMAGE : LoadPriority.TIER_3_ADDITIONAL;
      const imageUrl = await imageLoader.loadImage(
        firstPoster.fileId,
        firstPoster.url,
        priority,
        packId,
        0
      );

      setState(prev => ({
        ...prev,
        loadedImages: [imageUrl],
        isFirstImageLoaded: true,
        isLoading: false,
        hasError: false
      }));

      onImageLoaded?.(imageUrl, 0);
      console.log(`🎨 First image loaded for pack ${packId}:`, imageUrl);
    } catch (error) {
      console.warn('Failed to load first image:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true
      }));
    }
  }, [packId, selectedPosters, isHighPriority, onImageLoaded, state.isFirstImageLoaded]);

  // Прогрессивная загрузка остальных изображений
  const loadNextImage = useCallback(async () => {
    if (loadingRef.current.isProcessing || selectedPosters.length <= state.loadedImages.length) {
      return;
    }

    const nextIndex = state.loadedImages.length;
    const nextPoster = selectedPosters[nextIndex];
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

      setState(prev => ({
        ...prev,
        loadedImages: [...prev.loadedImages, imageUrl]
      }));

      onImageLoaded?.(imageUrl, nextIndex);
      console.log(`✅ Additional image ${nextIndex + 1} loaded for pack ${packId}:`, imageUrl);

      // Проверить, загружены ли все изображения
      if (state.loadedImages.length + 1 >= selectedPosters.length) {
        onAllImagesLoaded?.();
        console.log(`🎉 All images loaded for pack ${packId}`);
      }
    } catch (error) {
      console.warn(`Failed to load image ${nextIndex + 1}:`, error);
    } finally {
      loadingRef.current.isProcessing = false;
    }
  }, [packId, selectedPosters, state.loadedImages.length, isHighPriority, onImageLoaded, onAllImagesLoaded]);

  // Автоматическая загрузка следующего изображения
  useEffect(() => {
    if (!isVisible || !state.isFirstImageLoaded || loadingRef.current.isProcessing) {
      return;
    }

    // Задержка перед загрузкой следующего изображения
    const timer = setTimeout(() => {
      loadNextImage();
    }, 500 + Math.random() * 1000); // Случайная задержка 0.5-1.5 секунды

    return () => clearTimeout(timer);
  }, [isVisible, state.isFirstImageLoaded, state.loadedImages.length, loadNextImage]);

  // Запуск загрузки первого изображения
  useEffect(() => {
    if (isVisible && !state.isFirstImageLoaded && !state.isLoading) {
      loadFirstImage();
    }
  }, [isVisible, state.isFirstImageLoaded, state.isLoading, loadFirstImage]);

  // Слайдшоу - переключение между изображениями
  useEffect(() => {
    if (state.loadedImages.length < 2) return;

    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        currentImageIndex: (prev.currentImageIndex + 1) % prev.loadedImages.length
      }));
    }, 4000 + Math.random() * 2000); // Случайный интервал 4-6 секунд

    return () => clearInterval(interval);
  }, [state.loadedImages.length]);

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
    setState({
      loadedImages: [],
      currentImageIndex: 0,
      isLoading: false,
      isFirstImageLoaded: false,
      hasError: false
    });
    loadingRef.current = {
      currentIndex: 0,
      isProcessing: false,
      abortController: null
    };
  }, []);

  return {
    ...state,
    loadNextImageManually,
    reset,
    canLoadMore: state.loadedImages.length < selectedPosters.length,
    totalImages: selectedPosters.length,
    progress: selectedPosters.length > 0 ? (state.loadedImages.length / selectedPosters.length) * 100 : 0
  };
};

