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
  const currentIndexRef = useRef(0);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchingRef = useRef(false);

  // Сброс индекса при изменении количества стикеров
  useEffect(() => {
    if (currentIndex >= stickersCount) {
      setCurrentIndex(0);
    }
  }, [stickersCount, currentIndex]);

  // Автоматическая ротация: ждём preload следующего + стандартный интервал
  useEffect(() => {
    if (stickersCount <= 1 || !isVisible) return;

    let cancelled = false;

    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    const schedule = async () => {
      const baseDelay = isHovered ? hoverRotateInterval : autoRotateInterval;

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

      // 2) Ждём стандартный интервал (не короче, чем раньше)
      await delay(baseDelay);
      if (cancelled) return;

      // 3) Переключаемся
      setCurrentIndex(prev => (prev + 1) % stickersCount);

      // 4) Планируем следующий цикл
      if (!cancelled) {
        timeoutRef.current = setTimeout(() => {
          // запускаем асинхронно, не блокируя event loop
          schedule();
        }, 0);
      }
    };

    // стартуем цикл
    schedule();

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      switchingRef.current = false;
    };
  }, [stickersCount, isVisible, isHovered, autoRotateInterval, hoverRotateInterval, stickerSources]);

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
