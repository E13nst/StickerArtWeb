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
        setIsNear(entry.isIntersecting);
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

