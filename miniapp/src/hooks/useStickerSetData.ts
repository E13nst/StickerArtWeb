import { useState, useEffect, useMemo } from 'react';
import { StickerSetResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { useLikesStore } from '@/store/useLikesStore';
import { markAsGallerySticker } from '@/utils/imageLoader';

// Кеш полных данных стикерсетов для оптимистичного UI
interface CachedStickerSet {
  data: StickerSetResponse;
  timestamp: number;
  ttl: number;
}

const stickerSetCache = new Map<number, CachedStickerSet>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Ограничиваем размер кеша
const limitCacheSize = () => {
  if (stickerSetCache.size > 50) {
    const oldestKey = Array.from(stickerSetCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
    if (oldestKey) stickerSetCache.delete(oldestKey);
  }
};

interface UseStickerSetDataOptions {
  stickerSet: StickerSetResponse;
  preloadStickers?: (stickers: any[]) => Promise<void>;
}

export const useStickerSetData = ({ 
  stickerSet, 
  preloadStickers 
}: UseStickerSetDataOptions) => {
  const [fullStickerSet, setFullStickerSet] = useState<StickerSetResponse | null>(() => {
    const cached = stickerSetCache.get(stickerSet.id);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return stickerSet;
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { setLike, getLikeState } = useLikesStore();
  
  const effectiveStickerSet = fullStickerSet ?? stickerSet;
  const stickers = useMemo(() => {
    return effectiveStickerSet?.telegramStickerSetInfo?.stickers ?? [];
  }, [effectiveStickerSet?.telegramStickerSetInfo?.stickers]);

  useEffect(() => {
    let mounted = true;
    let abortController: AbortController | null = null;
    
    const loadFullStickerSet = async () => {
      // Проверяем кеш перед загрузкой
      const cached = stickerSetCache.get(stickerSet.id);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        if (mounted) {
          setFullStickerSet(cached.data);
          const packId = stickerSet.id.toString();
          const currentState = getLikeState(packId);
          if (!currentState.syncing) {
            const apiLikesCount = cached.data.likesCount ?? cached.data.likes;
            const apiIsLiked = cached.data.isLikedByCurrentUser ?? (cached.data as any).liked ?? cached.data.isLiked;
            const isLiked = apiIsLiked !== undefined ? apiIsLiked : currentState.isLiked;
            const likesCount = (apiLikesCount !== undefined && apiLikesCount >= 0) ? apiLikesCount : currentState.likesCount;
            setLike(packId, isLiked, likesCount);
          }
        }
        return;
      }
      
      try {
        if (!fullStickerSet || fullStickerSet.id !== stickerSet.id) {
          setLoading(true);
        }
        setError(null);
        
        abortController = new AbortController();
        const fullData = await apiClient.getStickerSet(stickerSet.id);
        
        if (!mounted || abortController.signal.aborted) return;
        
        // Сохраняем в кеш
        stickerSetCache.set(stickerSet.id, {
          data: fullData,
          timestamp: Date.now(),
          ttl: CACHE_TTL
        });
        limitCacheSize();
        
        if (mounted) {
          setFullStickerSet(fullData);
          
          // Синхронизируем store с сервером только если по этому пеку не идёт синхронизация (toggle),
          // иначе не перезаписываем оптимистичное состояние данными из getStickerSet
          const packId = stickerSet.id.toString();
          const currentState = getLikeState(packId);
          if (!currentState.syncing) {
            const apiLikesCount = fullData.likesCount ?? fullData.likes;
            const apiIsLiked = fullData.isLikedByCurrentUser ?? (fullData as any).liked ?? fullData.isLiked;
            const isLiked = apiIsLiked !== undefined ? apiIsLiked : currentState.isLiked;
            const likesCount = (apiLikesCount !== undefined && apiLikesCount >= 0) ? apiLikesCount : currentState.likesCount;
            setLike(packId, isLiked, likesCount);
          }
          
          // Предзагрузка стикеров
          const stickersList = fullData.telegramStickerSetInfo?.stickers || [];
          stickersList.forEach((sticker) => {
            if (sticker?.file_id) {
              markAsGallerySticker();
            }
          });

          if (!mounted || abortController.signal.aborted) return;
          
          // ✅ FIX: Запускаем предзагрузку в фоне, не блокируя UI
          if (preloadStickers) {
            preloadStickers(stickersList).catch(() => {
              // Игнорируем ошибки предзагрузки - не критично
            });
          }
        }
      } catch (err) {
        if (!mounted || abortController?.signal.aborted) return;
        
        console.warn('Ошибка загрузки полной информации о стикерсете:', err);
        if (mounted) {
          setError('Не удалось загрузить полную информацию о стикерсете');
          if (!fullStickerSet) {
            setFullStickerSet(stickerSet);
          }
        }
      } finally {
        if (mounted && !abortController?.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFullStickerSet();
    
    return () => { 
      mounted = false;
      abortController?.abort();
    };
  }, [stickerSet.id, getLikeState, setLike, preloadStickers, fullStickerSet]);

  const updateStickerSet = (updated: StickerSetResponse) => {
    setFullStickerSet(updated);
    stickerSetCache.set(stickerSet.id, {
      data: updated,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });
  };

  return {
    fullStickerSet,
    effectiveStickerSet,
    stickers,
    loading,
    error,
    updateStickerSet
  };
};

