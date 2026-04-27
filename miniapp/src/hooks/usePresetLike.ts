import { useCallback, useState } from 'react';
import { likeStylePreset, unlikeStylePreset } from '@/api/stylePresets';

interface UsePresetLikeResult {
  isLiked: boolean;
  isLoading: boolean;
  error: string | null;
  toggle: () => Promise<void>;
  clearError: () => void;
}

/**
 * Тогл сохранения пресета в «Лайкнутые».
 * Оптимистичное обновление: состояние меняется немедленно,
 * при ошибке сервера — откатывается.
 */
export function usePresetLike(
  presetId: number,
  initialLiked: boolean = false
): UsePresetLikeResult {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    if (isLoading) return;

    const prev = isLiked;
    setIsLiked(!prev);
    setIsLoading(true);
    setError(null);

    try {
      if (prev) {
        await unlikeStylePreset(presetId);
      } else {
        await likeStylePreset(presetId);
      }
    } catch (e) {
      setIsLiked(prev);
      setError(e instanceof Error ? e.message : 'Не удалось изменить статус сохранения');
    } finally {
      setIsLoading(false);
    }
  }, [isLiked, isLoading, presetId]);

  const clearError = useCallback(() => setError(null), []);

  return { isLiked, isLoading, error, toggle, clearError };
}
