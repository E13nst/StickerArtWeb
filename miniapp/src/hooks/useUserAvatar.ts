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
        console.log(`[useUserAvatar] Загрузка аватара для userId: ${userId}`);
        const photoData = await apiClient.getUserPhoto(userId);
        
        if (isCancelled) return;

        console.log(`[useUserAvatar] Получены данные фото:`, {
          hasFileId: !!photoData?.profilePhotoFileId,
          fileId: photoData?.profilePhotoFileId,
          totalPhotos: photoData?.profilePhotos?.total_count
        });

        if (photoData?.profilePhotoFileId) {
          console.log(`[useUserAvatar] Загрузка blob для fileId: ${photoData.profilePhotoFileId}`);
          const blob = await apiClient.getUserPhotoBlob(userId, photoData.profilePhotoFileId);
          
          if (isCancelled) return;

          console.log(`[useUserAvatar] Blob загружен:`, {
            size: blob.size,
            type: blob.type
          });

          const url = URL.createObjectURL(blob);
          avatarCache.set(userId, url);
          setAvatarBlobUrl(url);
          console.log(`[useUserAvatar] ✅ Аватар успешно загружен для userId: ${userId}`);
        } else {
          console.log(`[useUserAvatar] ⚠️ Нет profilePhotoFileId для userId: ${userId}`);
          setAvatarBlobUrl(null);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(`[useUserAvatar] ❌ Ошибка загрузки аватара для userId ${userId}:`, err);
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

