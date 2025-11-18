import { useState, useEffect, RefObject } from 'react';

interface ViewportVisibilityOptions {
  /**
   * Отступ для расширенной зоны видимости (по умолчанию 800px)
   * Используется для определения isNearViewport
   */
  rootMargin?: string;
  
  /**
   * Порог пересечения для точного viewport (по умолчанию 0.1)
   * 0.1 = элемент виден хотя бы на 10%
   */
  threshold?: number;
}

interface ViewportVisibilityResult {
  /**
   * Элемент видим в точном viewport (rootMargin: '0px')
   * Используется для TIER_1_VIEWPORT
   */
  isInViewport: boolean;
  
  /**
   * Элемент в расширенной зоне (rootMargin: '800px' по умолчанию)
   * Используется для TIER_2_NEAR_VIEWPORT
   */
  isNearViewport: boolean;
}

/**
 * Хук для определения видимости элемента в viewport
 * 
 * Использует два IntersectionObserver:
 * 1. Строгий (rootMargin: '0px') - для точного определения видимости
 * 2. Расширенный (rootMargin: '800px') - для определения близости к viewport
 * 
 * @example
 * ```tsx
 * const { ref } = useNearVisible();
 * const { isInViewport, isNearViewport } = useViewportVisibility(ref);
 * 
 * // isInViewport = true  -> элемент виден прямо сейчас (TIER_1)
 * // isNearViewport = true -> элемент близко к экрану (TIER_2)
 * ```
 */
export const useViewportVisibility = (
  ref: RefObject<Element>,
  options: ViewportVisibilityOptions = {}
): ViewportVisibilityResult => {
  const {
    rootMargin = '800px',
    threshold = 0.1
  } = options;

  const [isInViewport, setIsInViewport] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    // Observer для точного viewport (TIER_1_VIEWPORT)
    // Элемент должен быть виден хотя бы на 10% без отступов
    const strictObserver = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      {
        root: null, // viewport браузера
        rootMargin: '0px', // Без отступов - точное определение
        threshold // По умолчанию 0.1 (10% видимости)
      }
    );

    // Observer для расширенной зоны (TIER_2_NEAR_VIEWPORT)
    // Элемент в пределах 800px от viewport
    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin, // По умолчанию '800px'
        threshold: 0 // Любое пересечение
      }
    );

    strictObserver.observe(element);
    nearObserver.observe(element);

    return () => {
      strictObserver.disconnect();
      nearObserver.disconnect();
    };
  }, [ref, rootMargin, threshold]);

  return { isInViewport, isNearViewport };
};

