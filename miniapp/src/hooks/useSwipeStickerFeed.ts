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

// Кеш для полных данных стикерсетов
const fullDataCache = new Map<number, StickerSetResponse>();

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
  const loadingFullDataRef = useRef<Set<number>>(new Set());

  // Функция для загрузки полной информации о стикерсете
  const loadFullStickerSetData = useCallback(async (id: number) => {
    // Проверяем кеш
    if (fullDataCache.has(id)) {
      const cached = fullDataCache.get(id);
      if (cached) {
        setStickerSets((prev) =>
          prev.map((set) => (set.id === id ? cached : set))
        );
        return;
      }
    }

    // Проверяем, не загружается ли уже
    if (loadingFullDataRef.current.has(id)) {
      return;
    }

    loadingFullDataRef.current.add(id);

    try {
      const fullData = await apiClient.getStickerSet(id);
      
      // Сохраняем в кеш
      fullDataCache.set(id, fullData);
      
      // Обновляем в состоянии
      setStickerSets((prev) =>
        prev.map((set) => (set.id === id ? fullData : set))
      );
    } catch (err) {
      console.warn(`Не удалось загрузить полную информацию о стикерсете ${id}:`, err);
    } finally {
      loadingFullDataRef.current.delete(id);
    }
  }, []);

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

      // Загружаем полную информацию для первых карточек (preload)
      const setsToPreload = filteredSets.slice(0, 3);
      setsToPreload.forEach((set) => {
        loadFullStickerSetData(set.id);
      });

      currentPageRef.current = pageToLoad + 1;
      hasMorePagesRef.current = !response.last;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить стикеры');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isLiked, pageSize, loadFullStickerSetData]);

  const next = useCallback(() => {
    const current = stickerSets[currentIndex];
    if (current) {
      viewedIdsRef.current.add(current.id);
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setTotalViewed((v) => v + 1);

    // Загружаем полную информацию для следующих карточек
    const nextCard = stickerSets[nextIndex];
    if (nextCard && !fullDataCache.has(nextCard.id)) {
      loadFullStickerSetData(nextCard.id);
    }

    // Предзагрузка для карточек, которые скоро будут показаны
    for (let i = 1; i <= 2; i++) {
      const futureCard = stickerSets[nextIndex + i];
      if (futureCard && !fullDataCache.has(futureCard.id)) {
        loadFullStickerSetData(futureCard.id);
      }
    }

    const remaining = stickerSets.length - nextIndex;
    if (remaining <= preloadThreshold && hasMorePagesRef.current && !isFetchingRef.current) {
      fetchNextPage();
    }
  }, [currentIndex, stickerSets, preloadThreshold, fetchNextPage, loadFullStickerSetData]);

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
    loadingFullDataRef.current.clear();

    // Перезагрузка
    fetchNextPage();
  }, [fetchNextPage]);

  // Первичная загрузка
  useEffect(() => {
    if (stickerSets.length === 0 && !isLoading && !error) {
      fetchNextPage();
    }
  }, [stickerSets.length, isLoading, error, fetchNextPage]);

  // Загружаем полную информацию для текущей карточки
  useEffect(() => {
    const currentCard = stickerSets[currentIndex];
    if (currentCard && !fullDataCache.has(currentCard.id)) {
      loadFullStickerSetData(currentCard.id);
    }
  }, [currentIndex, stickerSets, loadFullStickerSetData]);

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

