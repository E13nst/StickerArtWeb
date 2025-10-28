import { useState, useEffect, useCallback, useRef } from 'react';
import { imageLoader } from '../utils/imageLoader';

interface UseStickerRotationProps {
  stickersCount: number;
  autoRotateInterval?: number;
  hoverRotateInterval?: number;
  isHovered?: boolean;
  isVisible?: boolean;
  // Опционально: источники стикеров для предварительной загрузки
  stickerSources?: Array<{ fileId: string; url: string }>;
}

export const useStickerRotation = ({
  stickersCount,
  autoRotateInterval = 2333, // 2333 ≈ 3000/φ (золотое сечение)
  hoverRotateInterval = 618, // Число Фибоначчи
  isHovered = false,
  isVisible = true,
  stickerSources
}: UseStickerRotationProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchingRef = useRef(false);

  // Сброс индекса при изменении количества стикеров
  useEffect(() => {
    if (currentIndex >= stickersCount) {
      setCurrentIndex(0);
    }
  }, [stickersCount, currentIndex]);

  // Автоматическая ротация с гарантией предварительной загрузки следующего изображения
  useEffect(() => {
    if (stickersCount <= 1 || !isVisible) return;

    const schedule = () => {
      const delay = isHovered ? hoverRotateInterval : autoRotateInterval;
      timeoutRef.current = setTimeout(async () => {
        if (switchingRef.current) return schedule();
        switchingRef.current = true;
        try {
          setCurrentIndex(prev => {
            const next = (prev + 1) % stickersCount;
            return next; // временно, финальное значение после preload
          });
          // Если есть источники — предварительно загрузим следующий
          if (stickerSources && stickerSources.length > 0) {
            const nextIdx = (currentIndex + 1) % Math.min(stickersCount, stickerSources.length);
            const src = stickerSources[nextIdx];
            if (src) {
              await imageLoader.loadImage(src.fileId, src.url, 1);
              // После успешной загрузки — окончательно переключаемся (на случай гонок)
              setCurrentIndex(next => next); // оставляем уже установленный next
            }
          }
        } catch (_) {
          // игнорируем ошибки загрузки, оставляем текущий стикер
        } finally {
          switchingRef.current = false;
          schedule();
        }
      }, delay);
    };

    schedule();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      switchingRef.current = false;
    };
  }, [stickersCount, isVisible, isHovered, autoRotateInterval, hoverRotateInterval, stickerSources, currentIndex]);

  // Ручное управление
  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % stickersCount);
  }, [stickersCount]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + stickersCount) % stickersCount);
  }, [stickersCount]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < stickersCount) {
      setCurrentIndex(index);
    }
  }, [stickersCount]);

  return {
    currentIndex,
    goToNext,
    goToPrevious,
    goToIndex
  };
};
