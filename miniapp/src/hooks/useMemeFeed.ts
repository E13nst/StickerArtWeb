import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNextMemeCandidate,
  likeMemeCandidate,
  dislikeMemeCandidate,
  MemeFeedLimitReachedError,
} from '@/api/memeCandidates';
import { MemeCandidateDto } from '@/types/meme';

export type MemeFeedVoteType = 'like' | 'dislike';

interface UseMemeFeedResult {
  /** Текущий кандидат для показа (null = ещё загружается или лента пуста) */
  current: MemeCandidateDto | null;
  /** true при первичной загрузке */
  isLoading: boolean;
  /** Ошибка загрузки/голосования */
  error: string | null;
  /** 204 — нет больше кандидатов */
  isEmpty: boolean;
  /** 429 — дневной лимит свайпов */
  isLimitReached: boolean;
  /** ISO-строка времени сброса лимита (если вернул сервер) */
  limitResetAt: string | null;
  /** Отправить голос. isSwipe=true — свайп (лимит + награда) */
  vote: (type: MemeFeedVoteType, isSwipe: boolean) => Promise<void>;
  /** Сбросить состояние и перезагрузить ленту */
  reset: () => void;
  /** Очистить ошибку */
  clearError: () => void;
}

/**
 * Управляет очередью мем-кандидатов:
 * – хранит текущего кандидата и предзагружает следующего в фоне;
 * – оптимистичный переход: анимация запускается до ответа сервера;
 * – при ошибке голосования откатывает кандидата обратно.
 */
export function useMemeFeed(): UseMemeFeedResult {
  const [current, setCurrent] = useState<MemeCandidateDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [limitResetAt, setLimitResetAt] = useState<string | null>(null);

  /** Предзагруженный следующий кандидат */
  const prefetchedRef = useRef<MemeCandidateDto | null>(null);
  const isPrefetchingRef = useRef(false);
  const isVotingRef = useRef(false);

  /** Загружает следующего кандидата и помещает в prefetchedRef */
  const prefetchNext = useCallback(async () => {
    if (isPrefetchingRef.current || isLimitReached) return;
    isPrefetchingRef.current = true;
    try {
      const next = await fetchNextMemeCandidate();
      prefetchedRef.current = next;
    } catch (e) {
      if (e instanceof MemeFeedLimitReachedError) {
        setIsLimitReached(true);
        setLimitResetAt(e.resetAt ?? null);
      }
    } finally {
      isPrefetchingRef.current = false;
    }
  }, [isLimitReached]);

  /** Загружает первого кандидата при инициализации */
  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const first = await fetchNextMemeCandidate();
      if (first === null) {
        setIsEmpty(true);
      } else {
        setCurrent(first);
        prefetchNext();
      }
    } catch (e) {
      if (e instanceof MemeFeedLimitReachedError) {
        setIsLimitReached(true);
        setLimitResetAt(e.resetAt ?? null);
      } else {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить мем-ленту');
      }
    } finally {
      setIsLoading(false);
    }
  }, [prefetchNext]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  /**
   * Отправляет голос.
   * Логика:
   * 1. Немедленно переходим к следующему кандидату (оптимистично).
   * 2. Параллельно отправляем запрос на сервер.
   * 3. При ошибке — откатываем к предыдущему кандидату и показываем ошибку.
   */
  const vote = useCallback(
    async (type: MemeFeedVoteType, isSwipe: boolean) => {
      if (!current || isVotingRef.current) return;

      const votedCandidate = current;
      isVotingRef.current = true;

      const nextCandidate = prefetchedRef.current;
      prefetchedRef.current = null;

      if (nextCandidate === null) {
        setIsEmpty(true);
      }
      setCurrent(nextCandidate);

      if (nextCandidate !== null) {
        prefetchNext();
      }

      try {
        if (type === 'like') {
          await likeMemeCandidate(votedCandidate.id, isSwipe);
        } else {
          await dislikeMemeCandidate(votedCandidate.id, isSwipe);
        }
      } catch (e) {
        if (e instanceof MemeFeedLimitReachedError) {
          setIsLimitReached(true);
          setLimitResetAt(e.resetAt ?? null);
        } else {
          setError(e instanceof Error ? e.message : 'Не удалось отправить голос');
          setCurrent(votedCandidate);
          prefetchedRef.current = nextCandidate;
          if (nextCandidate !== null) setIsEmpty(false);
        }
      } finally {
        isVotingRef.current = false;
      }
    },
    [current, prefetchNext]
  );

  const reset = useCallback(() => {
    setCurrent(null);
    setIsLoading(true);
    setError(null);
    setIsEmpty(false);
    setIsLimitReached(false);
    setLimitResetAt(null);
    prefetchedRef.current = null;
    isPrefetchingRef.current = false;
    isVotingRef.current = false;
    loadInitial();
  }, [loadInitial]);

  const clearError = useCallback(() => setError(null), []);

  return {
    current,
    isLoading,
    error,
    isEmpty,
    isLimitReached,
    limitResetAt,
    vote,
    reset,
    clearError,
  };
}
