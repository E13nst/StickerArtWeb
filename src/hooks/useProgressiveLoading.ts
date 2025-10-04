import { useEffect, useRef, useState } from 'react';

interface ProgressiveLoadingOptions {
  initialBatch?: number;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export function useProgressiveLoading(
  totalItems: number,
  options: ProgressiveLoadingOptions = {}
) {
  const {
    initialBatch = 4,
    batchSize = 2,
    delayBetweenBatches = 1000
  } = options;

  const [visibleItems, setVisibleItems] = useState(initialBatch);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const loadNextBatch = () => {
    if (visibleItems >= totalItems) return;

    setIsLoading(true);
    
    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setVisibleItems(prev => Math.min(prev + batchSize, totalItems));
      setIsLoading(false);
    }, delayBetweenBatches);
  };

  const reset = () => {
    setVisibleItems(initialBatch);
    setIsLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    visibleItems,
    isLoading,
    loadNextBatch,
    reset,
    hasMore: visibleItems < totalItems
  };
}
