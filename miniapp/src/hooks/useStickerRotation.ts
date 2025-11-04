import { useState, useEffect, useCallback, useRef } from 'react';
import { imageLoader } from '../utils/imageLoader';
import { imageCache } from '../utils/galleryUtils';
import { animationCache } from '../utils/animationLoader';

interface UseStickerRotationProps {
  stickersCount: number;
  autoRotateInterval?: number;
  hoverRotateInterval?: number;
  isHovered?: boolean;
  isVisible?: boolean;
  // Опционально: источники стикеров для предварительной загрузки
  stickerSources?: Array<{ fileId: string; url: string; isAnimated?: boolean }>;
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
  const isStickerReady = useCallback((fileId: string, url: string, isAnimated?: boolean): boolean => {
    // Проверяем что изображение в кеше
    if (!imageCache.get(fileId)) {
      return false;
    }
    
    // Для анимированных стикеров проверяем JSON в кеше
    if (isAnimated && !animationCache.get(fileId)) {
      return false;
    }
    
    return true;
  }, []);

  // Автоматическая ротация: ждём готовности текущего + загрузки следующего + стандартный интервал
  useEffect(() => {
    if (stickersCount <= 1 || !isVisible) return;

    let cancelled = false;

    const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

    // Функция ожидания готовности стикера с таймаутом и проверкой реальной загрузки
    const waitForStickerReady = async (fileId: string, url: string, isAnimated?: boolean, timeoutMs: number = 6000): Promise<boolean> => {
      const startTime = Date.now();
      
      // Проверяем сразу - если уже в кэше и готов
      if (isStickerReady(fileId, url, isAnimated)) {
        // Для анимаций дополнительно проверяем что JSON действительно загружен
        if (isAnimated) {
          const animData = animationCache.get(fileId);
          if (animData) {
            return true;
          }
        } else {
          // Для обычных изображений проверяем реальную готовность через Image
          const cachedUrl = imageCache.get(fileId);
          if (cachedUrl) {
            try {
              const img = new Image();
              img.src = cachedUrl;
              // Если изображение уже загружено браузером, complete будет true
              if (img.complete) {
                return true;
              }
              // Иначе ждем загрузки с таймаутом
              const loadPromise = new Promise<boolean>((resolve) => {
                const timeout = setTimeout(() => {
                  resolve(img.complete);
                }, 500); // 500мс на загрузку
                
                img.onload = () => {
                  clearTimeout(timeout);
                  resolve(true);
                };
                img.onerror = () => {
                  clearTimeout(timeout);
                  resolve(false);
                };
              });
              if (await loadPromise) {
                return true;
              }
            } catch {
              // Игнорируем ошибки проверки
            }
          }
        }
      }
      
      // Пробуем загрузить если нет в кеше
      try {
        await imageLoader.loadImage(fileId, url, 1);
        
        // После загрузки через imageLoader, проверяем реальную готовность
        if (isAnimated) {
          // Для анимаций проверяем наличие JSON
          if (!animationCache.has(fileId)) {
            // Пробуем загрузить анимацию
            try {
              const response = await fetch(url);
              if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  const data = await response.json();
                  animationCache.set(fileId, data);
                  return true;
                }
              }
            } catch {
              // Игнорируем ошибки
            }
          } else {
            return true;
          }
        } else {
          // Для обычных изображений проверяем реальную загрузку
          const cachedUrl = imageCache.get(fileId);
          if (cachedUrl) {
            const img = new Image();
            img.src = cachedUrl;
            if (img.complete) {
              return true;
            }
            // Ждем загрузки с таймаутом (увеличиваем до 500мс как пользователь указал)
            const loadPromise = new Promise<boolean>((resolve) => {
              const timeout = setTimeout(() => {
                resolve(img.complete);
              }, 500); // 500мс на загрузку как указал пользователь
              
              img.onload = () => {
                clearTimeout(timeout);
                resolve(true);
              };
              img.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
              };
            });
            return await loadPromise;
          }
        }
      } catch {
        // ignore load errors
      }
      
      // Проверяем периодически с небольшими интервалами до таймаута
      while (Date.now() - startTime < timeoutMs) {
        if (cancelled) return false;
        
        if (isStickerReady(fileId, url, isAnimated)) {
          // Дополнительная проверка реальной готовности
          if (!isAnimated) {
            const cachedUrl = imageCache.get(fileId);
            if (cachedUrl) {
              try {
                const img = new Image();
                img.src = cachedUrl;
                if (img.complete) {
                  return true;
                }
              } catch {
                // Игнорируем
              }
            }
          } else {
            // Для анимаций проверяем наличие данных
            if (animationCache.has(fileId)) {
              return true;
            }
          }
        }
        
        await delay(100); // проверяем каждые 100ms (было 50ms)
      }
      
      // Таймаут - считаем готовым если изображение хотя бы попыталось загрузиться
      // Но лучше вернуть false чтобы не показывать неготовый стикер
      return isStickerReady(fileId, url, isAnimated);
    };

    const checkCancel = () => {
      if (document.body.classList.contains('modal-open') || cancelled) {
        cancelled = true;
        return true;
      }
      return false;
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
      
      if (checkCancel()) return;

      // 2) Проверяем готовность СЛЕДУЮЩЕГО стикера (увеличиваем таймаут до 6000мс)
      if (stickerSources && stickerSources.length > 0) {
        const nextIdx = (currentIdx + 1) % Math.min(stickersCount, stickerSources.length);
        const nextSrc = stickerSources[nextIdx];
        if (nextSrc) {
          const isReady = await waitForStickerReady(nextSrc.fileId, nextSrc.url, nextSrc.isAnimated, 6000);
          // Логируем для отладки
          if (import.meta.env.DEV) {
            console.log(`🎨 Next sticker ${nextIdx} ready: ${isReady}`, nextSrc.fileId);
          }
          
          // Если стикер готов, добавляем небольшую задержку (50-100мс) для гарантии полной готовности
          // Это помогает избежать пауз при переключении
          if (isReady) {
            await delay(100); // Даем дополнительное время на полную загрузку
          }
        }
      }

      if (checkCancel()) return;

      // 3) Переключаемся только если всё готово
      setCurrentIndex(prev => (prev + 1) % stickersCount);

      // 4) Планируем следующий цикл
      if (!cancelled) {
        timeoutRef.current = setTimeout(() => {
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
