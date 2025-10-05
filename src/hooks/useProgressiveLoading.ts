import { useState, useCallback } from 'react';

interface ProgressiveLoadingOptions {
  initialBatch?: number;
  batchSize?: number;
}

export function useProgressiveLoading(
  totalItems: number,
  options: ProgressiveLoadingOptions = {}
) {
  const {
    initialBatch = 6,
    batchSize = 2
  } = options;

  const [visibleItems, setVisibleItems] = useState(initialBatch);
  const [isLoading, setIsLoading] = useState(false);

  const loadNextBatch = useCallback(() => {
    if (visibleItems >= totalItems) return;

    setIsLoading(true);
    
    // Загружаем сразу без задержки
    setVisibleItems(prev => Math.min(prev + batchSize, totalItems));
    setIsLoading(false);
  }, [visibleItems, totalItems, batchSize]);

  // Новая функция для загрузки до определенного индекса
  const loadUpToIndex = useCallback((targetIndex: number) => {
    if (targetIndex >= totalItems) return;
    
    setIsLoading(true);
    setVisibleItems(Math.min(targetIndex + 1, totalItems));
    setIsLoading(false);
  }, [totalItems]);

  const reset = () => {
    setVisibleItems(initialBatch);
    setIsLoading(false);
  };

  return {
    visibleItems,
    isLoading,
    loadNextBatch,
    loadUpToIndex,
    reset,
    hasMore: visibleItems < totalItems
  };
}
