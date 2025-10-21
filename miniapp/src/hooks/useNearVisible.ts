import { useEffect, useRef, useState } from 'react';

interface UseNearVisibleOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useNearVisible(options: UseNearVisibleOptions = {}) {
  const { rootMargin = '800px', threshold = 0 } = options;
  const [isNear, setIsNear] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const newIsNear = entry.isIntersecting;
        setIsNear(prevIsNear => {
          if (prevIsNear !== newIsNear) {
            return newIsNear;
          }
          return prevIsNear;
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return { ref, isNear };
}




