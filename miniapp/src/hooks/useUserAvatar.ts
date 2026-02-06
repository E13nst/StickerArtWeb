/**
 * Hook для загрузки и кэширования аватара пользователя по userId.
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { getOptimalAvatarFileId } from '@/utils/avatarUtils';

const avatarCache = new Map<number, string>();

export function useUserAvatar(userId?: number) {
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setAvatarBlobUrl(null);
      return;
    }

    const cached = avatarCache.get(userId);
    if (cached) {
      setAvatarBlobUrl(cached);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const photoData = await apiClient.getUserPhoto(userId);
        if (isCancelled) return;

        const fileIdToLoad =
          photoData?.profilePhotoFileId ?? getOptimalAvatarFileId(photoData?.profilePhotos);
        if (fileIdToLoad) {
          const blob = await apiClient.getUserPhotoBlob(userId, fileIdToLoad);
          if (isCancelled) return;
          const url = URL.createObjectURL(blob);
          avatarCache.set(userId, url);
          setAvatarBlobUrl(url);
        } else {
          setAvatarBlobUrl(null);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setAvatarBlobUrl(null);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    })();

    return () => { isCancelled = true; };
  }, [userId]);

  return { avatarBlobUrl, isLoading, error };
}

/**
 * Очищает кэш аватаров (полезно при logout)
 */
export function clearAvatarCache() {
  // Освобождаем blob URLs
  for (const url of avatarCache.values()) {
    URL.revokeObjectURL(url);
  }
  avatarCache.clear();
}

