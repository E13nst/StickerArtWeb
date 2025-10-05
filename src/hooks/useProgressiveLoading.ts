import { useState } from 'react';

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

  const loadNextBatch = () => {
    if (visibleItems >= totalItems) return;

    setIsLoading(true);
    
    // Загружаем сразу без задержки
    setVisibleItems(prev => Math.min(prev + batchSize, totalItems));
    setIsLoading(false);
  };

  const reset = () => {
    setVisibleItems(initialBatch);
    setIsLoading(false);
  };

  return {
    visibleItems,
    isLoading,
    loadNextBatch,
    reset,
    hasMore: visibleItems < totalItems
  };
}
