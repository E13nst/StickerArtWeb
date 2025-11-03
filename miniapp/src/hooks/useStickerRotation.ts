import { useState, useEffect, useCallback, useRef } from 'react';
import { imageLoader } from '../utils/imageLoader';
import { imageCache } from '../utils/galleryUtils';

interface UseStickerRotationProps {
  stickersCount: number;
  autoRotateInterval?: number;
  hoverRotateInterval?: number;
  isHovered?: boolean;
  isVisible?: boolean;
  // Опционально: источники стикеров для предварительной загрузки
  stickerSources?: Array<{ fileId: string; url: string }>;
  // Минимальное время показа стикера (по умолчанию 2 секунды)
  minDisplayDuration?: number;
}

export const useStickerRotation = ({
  stickersCount,
  autoRotateInterval = 2333, // 2333 ≈ 3000/φ (золотое сечение)
  hoverRotateInterval = 618, // Число Фибоначчи
  isHovered = false,
  isVisible = true,
  stickerSources,
  minDisplayDuration = 2000 // Минимум 2 секунды показа
}: UseStickerRotationProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchingRef = useRef(false);
  const stickerShownAtRef = useRef<number>(Date.now()); // Время показа текущего стикера

  // Обновляем время показа при изменении индекса
  useEffect(() => {
    stickerShownAtRef.current = Date.now();
  }, [currentIndex]);

  // Сброс индекса при изменении количества стикеров
  useEffect(() => {
    if (currentIndex >= stickersCount) {
      setCurrentIndex(0);
    }
  }, [stickersCount, currentIndex]);

  // Функция проверки готовности стикера (изображение + JSON если анимированный)
  const isStickerReady = useCallback((fileId: string, url: string): boolean => {
    // Проверяем что изображение в кеше
    if (!imageCache.get(fileId)) {
      return false;
    }
    
    // Проверяем JSON в кеше (может быть анимированный стикер)
    // Если JSON в кеше - отлично, если нет - может быть статичный стикер (это нормально)
    // Главное - изображение должно быть готово
    return true;
  }, []);

  // Автоматическая ротация: ждём готовности текущего + загрузки следующего + стандартный интервал
  useEffect(() => {
    if (stickersCount <= 1 || !isVisible) return;

    let cancelled = false;

    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    // Функция ожидания готовности стикера с таймаутом
    const waitForStickerReady = async (fileId: string, url: string, timeoutMs: number = 5000): Promise<boolean> => {
      const startTime = Date.now();
      
      // Проверяем сразу
      if (isStickerReady(fileId, url)) {
        return true;
      }
      
      // Пробуем загрузить если нет в кеше
      try {
        await imageLoader.loadImage(fileId, url, 1);
      } catch {
        // ignore load errors
      }
      
      // Проверяем периодически с небольшими интервалами
      while (Date.now() - startTime < timeoutMs) {
        if (cancelled) return false;
        
        if (isStickerReady(fileId, url)) {
          return true;
        }
        
        await delay(50); // проверяем каждые 50ms
      }
      
      // Таймаут - считаем готовым если изображение хотя бы попыталось загрузиться
      return imageCache.get(fileId) !== undefined;
    };

    const schedule = async () => {
      const currentIdx = currentIndexRef.current;

      // 1) Ждём пока стикер был показан МИНИМУМ minDisplayDuration секунд
      const timeShown = Date.now() - stickerShownAtRef.current;
      const remainingTime = Math.max(0, minDisplayDuration - timeShown);
      
      if (remainingTime > 0) {
        console.log(`⏳ Waiting ${remainingTime}ms to reach minimum display duration`);
        await delay(remainingTime);
      }
      
      if (cancelled) return;

      // 2) Проверяем готовность СЛЕДУЮЩЕГО стикера (загружается фоном из PackCard)
      if (stickerSources && stickerSources.length > 0) {
        const nextIdx = (currentIdx + 1) % Math.min(stickersCount, stickerSources.length);
        const nextSrc = stickerSources[nextIdx];
        if (nextSrc) {
          await waitForStickerReady(nextSrc.fileId, nextSrc.url, 3000);
        }
      }

      if (cancelled) return;

      // 3) Переключаемся только если всё готово
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
  }, [stickersCount, isVisible, isHovered, autoRotateInterval, hoverRotateInterval, stickerSources, isStickerReady]);

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
