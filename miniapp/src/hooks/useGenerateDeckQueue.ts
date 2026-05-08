import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import type { DeckAction, DeckActionResponse, DeckCard, DeckProgress } from '@/types/deck';
import type { SwipeLimitError, SwipeStatsResponse } from '@/types/sticker';

const DEFAULT_LIMIT = 20;
const REFETCH_THRESHOLD = 5;

export interface UseGenerateDeckQueueResult {
  cards: DeckCard[];
  swipeStats: SwipeStatsResponse | null;
  deckProgress: DeckProgress | null;
  isLoading: boolean;
  isPrefetching: boolean;
  error: string | null;
  limitInfo: SwipeLimitError | null;
  refresh: () => Promise<void>;
  commitDeckAction: (
    cardInstanceId: string,
    action: DeckAction,
  ) => Promise<{ ok: boolean; data?: DeckActionResponse | null; limitHit?: boolean }>;
  removeCardHeadIfMatches: (cardInstanceId: string) => void;
}

export function useGenerateDeckQueue(enabled: boolean): UseGenerateDeckQueueResult {
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [swipeStats, setSwipeStats] = useState<SwipeStatsResponse | null>(null);
  const [deckProgress, setDeckProgress] = useState<DeckProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitInfo, setLimitInfo] = useState<SwipeLimitError | null>(null);

  const cardsRef = useRef(cards);
  const prefetchInFlight = useRef(false);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const mergeResponseMeta = useCallback((data: DeckActionResponse | null | undefined) => {
    if (!data) return;
    if (data.swipeStats) setSwipeStats(data.swipeStats);
    if (data.deckProgress) setDeckProgress(data.deckProgress);
  }, []);

  const fetchBatch = useCallback(
    async (mode: 'initial' | 'more') => {
      if (!enabled) return;
      const existingIds = new Set(cardsRef.current.map((c) => c.cardInstanceId));
      if (mode === 'more') {
        if (prefetchInFlight.current) return;
        prefetchInFlight.current = true;
        setIsPrefetching(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const res = await apiClient.getDeckCards({ limit: DEFAULT_LIMIT });
        setSwipeStats(res.swipeStats);
        setDeckProgress(res.deckProgress);
        setLimitInfo(null);
        const incoming = res.cards.filter((c) => !existingIds.has(c.cardInstanceId));
        if (mode === 'more') {
          if (incoming.length > 0) {
            setCards((prev) => [...prev, ...incoming]);
          }
        } else {
          setCards(res.cards);
        }
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        const body = (e as { response?: { data?: SwipeLimitError } })?.response?.data;
        if (status === 429 && body && typeof body === 'object' && 'dailyLimit' in body) {
          setLimitInfo(body as SwipeLimitError);
        } else {
          setError(extractMsg(e));
        }
      } finally {
        if (mode === 'more') {
          prefetchInFlight.current = false;
          setIsPrefetching(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [enabled],
  );

  const refresh = useCallback(async () => {
    await fetchBatch('initial');
  }, [fetchBatch]);

  useEffect(() => {
    if (!enabled) {
      setCards([]);
      setSwipeStats(null);
      setDeckProgress(null);
      setError(null);
      setLimitInfo(null);
      return;
    }
    void fetchBatch('initial');
  }, [enabled, fetchBatch]);

  useEffect(() => {
    if (!enabled || cards.length === 0 || cards.length > REFETCH_THRESHOLD || isLoading || limitInfo) return;
    void fetchBatch('more');
  }, [enabled, cards.length, fetchBatch, isLoading, limitInfo]);

  const commitDeckAction = useCallback(
    async (cardInstanceId: string, action: DeckAction) => {
      try {
        const data = await apiClient.postDeckAction({ cardInstanceId, action });
        if (data.success) {
          mergeResponseMeta(data);
          setLimitInfo(null);
          return { ok: true as const, data };
        }
        return { ok: false as const, data };
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        const body = (e as { response?: { data?: SwipeLimitError } })?.response?.data;
        if (status === 429 && body && typeof body === 'object') {
          setLimitInfo(body as SwipeLimitError);
          return { ok: false as const, limitHit: true as const };
        }
        setError(extractMsg(e));
        return { ok: false as const };
      }
    },
    [mergeResponseMeta],
  );

  const removeCardHeadIfMatches = useCallback((cardInstanceId: string) => {
    setCards((prev) => {
      if (prev.length === 0 || prev[0].cardInstanceId !== cardInstanceId) return prev;
      return prev.slice(1);
    });
  }, []);

  return {
    cards,
    swipeStats,
    deckProgress,
    isLoading: enabled && isLoading,
    isPrefetching,
    error,
    limitInfo,
    refresh,
    commitDeckAction,
    removeCardHeadIfMatches,
  };
}

function extractMsg(e: unknown): string {
  const d = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (typeof d === 'string' && d) return d;
  return e instanceof Error ? e.message : 'Не удалось выполнить действие';
}
