import { useEffect, useRef, useState } from 'react';
import { imageLoader } from '../utils/imageLoader';

interface UseProgressiveSlideshowOptions {
  posterUrls: string[];
  fileIds: string[];
  isVisible: boolean;
  isDocumentHidden: boolean;
  prefersReducedMotion: boolean;
  posters: Array<{ 
    fileId: string; 
    url: string; 
    isAnimated?: boolean;
    emoji?: string;
  }>;
}

export function useProgressiveSlideshow({
  posterUrls,
  fileIds,
  isVisible,
  isDocumentHidden,
  prefersReducedMotion,
  posters: _posters
}: UseProgressiveSlideshowOptions) {
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();
  const loadingRef = useRef(false);

  // Загрузка дополнительных изображений при видимости
  useEffect(() => {
    if (!isVisible || isDocumentHidden || prefersReducedMotion || loadingRef.current) {
      return;
    }

    const loadNextImage = async () => {
      if (loadedImages.length >= 4) return; // Максимум 4 изображения
      
      const nextIndex = loadedImages.length;
      if (nextIndex >= fileIds.length) return;

      loadingRef.current = true;
      setIsLoading(true);

      try {
        const imageUrl = await imageLoader.loadImage(
          fileIds[nextIndex],
          posterUrls[nextIndex],
          1 // Низкий приоритет для дополнительных изображений
        );
        
        setLoadedImages(prev => [...prev, imageUrl]);
      } catch (error) {
        console.warn('Failed to load additional image:', error);
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
      }
    };

    // Загрузить следующее изображение через requestIdleCallback
    const scheduleLoad = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadNextImage, { timeout: 2000 });
      } else {
        setTimeout(loadNextImage, 100);
      }
    };

    scheduleLoad();
  }, [isVisible, isDocumentHidden, prefersReducedMotion, loadedImages.length, fileIds, posterUrls]);

  // Запуск слайдшоу при наличии 2+ изображений
  useEffect(() => {
    if (loadedImages.length < 2 || !isVisible || isDocumentHidden || prefersReducedMotion) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    // Случайный интервал 4-6 секунд
    const interval = 4000 + Math.random() * 2000;
    
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % loadedImages.length);
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadedImages.length, isVisible, isDocumentHidden, prefersReducedMotion]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    currentImage: loadedImages[currentIndex] || loadedImages[0],
    allImages: loadedImages,
    isLoading,
    hasMultipleImages: loadedImages.length > 1
  };
}
