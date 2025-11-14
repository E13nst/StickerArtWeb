/**
 * Hook для загрузки и кэширования аватара пользователя
 */

import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';

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

    // Проверяем кэш
    const cached = avatarCache.get(userId);
    if (cached) {
      setAvatarBlobUrl(cached);
      return;
    }

    // Загружаем аватар
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const photoData = await apiClient.getUserPhoto(userId);
        
        if (isCancelled) return;

        if (photoData?.profilePhotoFileId) {
          const blob = await apiClient.getUserPhotoBlob(userId, photoData.profilePhotoFileId);
          
          if (isCancelled) return;

          const url = URL.createObjectURL(blob);
          avatarCache.set(userId, url);
          setAvatarBlobUrl(url);
        } else {
          setAvatarBlobUrl(null);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('Не удалось загрузить аватар:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setAvatarBlobUrl(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    })();

    // Cleanup
    return () => {
      isCancelled = true;
    };
  }, [userId]);

  return {
    avatarBlobUrl,
    isLoading,
    error
  };
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

