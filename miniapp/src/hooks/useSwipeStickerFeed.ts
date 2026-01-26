import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { StickerSetResponse, SwipeLimitError, SwipeStatsResponse } from '@/types/sticker';

interface UseSwipeStickerFeedOptions {
  pageSize?: number;
  preloadThreshold?: number;
}

interface UseSwipeStickerFeedResult {
  stickerSets: StickerSetResponse[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  next: () => void;
  reset: () => void;
  totalViewed: number;
  swipeStats: SwipeStatsResponse | null;
  isLimitReached: boolean;
  limitInfo: SwipeLimitError | null;
  emptyMessage: string | null;
  swipeLike: (stickerSetId: number) => Promise<void>;
  swipeDislike: (stickerSetId: number) => Promise<void>;
}

/**
 * Отдельный фид для свайп-страницы.
 * Важно: НЕ трогает логику галереи и не переиспользует `useStickerFeed`.
 */
export const useSwipeStickerFeed = (options: UseSwipeStickerFeedOptions = {}): UseSwipeStickerFeedResult => {
  const { preloadThreshold = 5 } = options;

  const [stickerSets, setStickerSets] = useState<StickerSetResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalViewed, setTotalViewed] = useState(0);
  const [swipeStats, setSwipeStats] = useState<SwipeStatsResponse | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [limitInfo, setLimitInfo] = useState<SwipeLimitError | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);

  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  const viewedIdsRef = useRef<Set<number>>(new Set());
  const stickerSetsRef = useRef<StickerSetResponse[]>([]);

  useEffect(() => {
    stickerSetsRef.current = stickerSets;
  }, [stickerSets]);

  const fetchStats = useCallback(async () => {
    try {
      const stats = await apiClient.getSwipeStats();
      setSwipeStats(stats);
    } catch (e) {
      console.warn('⚠️ Не удалось загрузить статистику свайпов:', e);
    }
  }, []);

  const fetchRandomStickerSet = useCallback(async () => {
    if (isFetchingRef.current || !hasMoreRef.current || isLimitReached) return;

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      let attempts = 0;
      let newSet: StickerSetResponse | null = null;

      while (attempts < 3 && !newSet) {
        const response = await apiClient.getRandomStickerSet();
        const alreadyViewed = viewedIdsRef.current.has(response.id);
        const alreadyQueued = stickerSetsRef.current.some((set) => set.id === response.id);

        if (!alreadyViewed && !alreadyQueued) {
          newSet = response;
          break;
        }

        attempts += 1;
      }

      if (newSet) {
        setStickerSets((prev) => [...prev, newSet as StickerSetResponse]);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data as SwipeLimitError | undefined;

      if (status === 404) {
        setEmptyMessage('Нет доступных стикерсетов');
        hasMoreRef.current = false;
      } else if (status === 429 && data) {
        setLimitInfo(data);
        setIsLimitReached(true);
        hasMoreRef.current = false;
      } else {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить стикеры');
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isLimitReached]);

  const next = useCallback(() => {
    const current = stickerSetsRef.current[currentIndex];
    if (current) {
      viewedIdsRef.current.add(current.id);
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setTotalViewed((v) => v + 1);

    const remaining = stickerSetsRef.current.length - nextIndex;
    if (remaining <= preloadThreshold && hasMoreRef.current && !isFetchingRef.current && !isLimitReached) {
      fetchRandomStickerSet();
    }
  }, [currentIndex, preloadThreshold, fetchRandomStickerSet, isLimitReached]);

  const reset = useCallback(() => {
    setStickerSets([]);
    setCurrentIndex(0);
    setTotalViewed(0);
    setError(null);
    setIsLoading(false);
    setIsLimitReached(false);
    setLimitInfo(null);
    setEmptyMessage(null);

    hasMoreRef.current = true;
    isFetchingRef.current = false;
    viewedIdsRef.current.clear();

    // Перезагрузка
    fetchStats();
    fetchRandomStickerSet();
  }, [fetchRandomStickerSet, fetchStats]);

  const swipeLike = useCallback(
    async (stickerSetId: number) => {
      try {
        await apiClient.swipeLikeStickerSet(stickerSetId);
        fetchStats();
        next();
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Не удалось поставить лайк');
      }
    },
    [fetchStats, next]
  );

  const swipeDislike = useCallback(
    async (stickerSetId: number) => {
      try {
        await apiClient.swipeDislikeStickerSet(stickerSetId);
        fetchStats();
        next();
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Не удалось поставить дизлайк');
      }
    },
    [fetchStats, next]
  );

  // Первичная загрузка
  useEffect(() => {
    if (stickerSets.length === 0 && !isLoading && !error && !isLimitReached) {
      fetchStats();
      fetchRandomStickerSet();
    }
  }, [stickerSets.length, isLoading, error, fetchRandomStickerSet, fetchStats, isLimitReached]);

  const hasMore = !isLimitReached && (currentIndex < stickerSets.length || hasMoreRef.current);

  return {
    stickerSets,
    currentIndex,
    isLoading,
    error,
    hasMore,
    next,
    reset,
    totalViewed,
    swipeStats,
    isLimitReached,
    limitInfo,
    emptyMessage,
    swipeLike,
    swipeDislike
  };
};

