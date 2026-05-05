import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import type { MiniAppSessionResponse } from '@/types/appSession';

export interface UseAppSessionBootstrapResult {
  session: MiniAppSessionResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Запрос session при монтировании (cold open экрана).
 * При отсутствии эндпоинта на бэкенде возвращает null без падения UI.
 */
export function useAppSessionBootstrap(): UseAppSessionBootstrapResult {
  const [session, setSession] = useState<MiniAppSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.getAppSession();
        if (!cancelled) setSession(data);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'session failed';
          setError(msg);
          setSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { session, loading, error, refetch };
}
