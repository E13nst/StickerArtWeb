import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { useLikesStore } from '@/store/useLikesStore';
import { StickerSetResponse } from '@/types/sticker';

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
}

/**
 * Отдельный фид для свайп-страницы.
 * Важно: НЕ трогает логику галереи и не переиспользует `useStickerFeed`.
 */
export const useSwipeStickerFeed = (options: UseSwipeStickerFeedOptions = {}): UseSwipeStickerFeedResult => {
  const { pageSize = 20, preloadThreshold = 5 } = options;

  const isLiked = useLikesStore((state) => state.isLiked);

  const [stickerSets, setStickerSets] = useState<StickerSetResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalViewed, setTotalViewed] = useState(0);

  const currentPageRef = useRef(0);
  const hasMorePagesRef = useRef(true);
  const isFetchingRef = useRef(false);
  const viewedIdsRef = useRef<Set<number>>(new Set());

  const fetchNextPage = useCallback(async () => {
    if (isFetchingRef.current || !hasMorePagesRef.current) return;

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const pageToLoad = currentPageRef.current;
      const response = await apiClient.getStickerSets(pageToLoad, pageSize, {
        sort: 'createdAt',
        direction: 'DESC',
        preview: true,
      });

      const newSets = response.content || [];

      // Фильтр: исключаем лайкнутые и уже просмотренные
      const filteredSets = newSets.filter((set) => {
        const packId = String(set.id);
        const alreadyLiked = isLiked(packId);
        const alreadyViewed = viewedIdsRef.current.has(set.id);
        return !alreadyLiked && !alreadyViewed;
      });

      setStickerSets((prev) => [...prev, ...filteredSets]);

      currentPageRef.current = pageToLoad + 1;
      hasMorePagesRef.current = !response.last;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить стикеры');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isLiked, pageSize]);

  const next = useCallback(() => {
    const current = stickerSets[currentIndex];
    if (current) {
      viewedIdsRef.current.add(current.id);
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setTotalViewed((v) => v + 1);

    const remaining = stickerSets.length - nextIndex;
    if (remaining <= preloadThreshold && hasMorePagesRef.current && !isFetchingRef.current) {
      fetchNextPage();
    }
  }, [currentIndex, stickerSets, preloadThreshold, fetchNextPage]);

  const reset = useCallback(() => {
    setStickerSets([]);
    setCurrentIndex(0);
    setTotalViewed(0);
    setError(null);
    setIsLoading(false);

    currentPageRef.current = 0;
    hasMorePagesRef.current = true;
    isFetchingRef.current = false;
    viewedIdsRef.current.clear();

    // Перезагрузка
    fetchNextPage();
  }, [fetchNextPage]);

  // Первичная загрузка
  useEffect(() => {
    if (stickerSets.length === 0 && !isLoading && !error) {
      fetchNextPage();
    }
  }, [stickerSets.length, isLoading, error, fetchNextPage]);

  const hasMore = currentIndex < stickerSets.length || hasMorePagesRef.current;

  return {
    stickerSets,
    currentIndex,
    isLoading,
    error,
    hasMore,
    next,
    reset,
    totalViewed,
  };
};

