/**
 * Hook для управления понравившимися стикерсетами
 * Выделен из MyProfilePage для упрощения и переиспользования
 */

import { useState, useCallback, useEffect } from 'react';
import { useLikesStore } from '@/store/useLikesStore';
import { apiClient } from '@/api/client';
import { StickerSetResponse } from '@/types/sticker';

export function useLikedSets() {
  const [likedStickerSets, setLikedStickerSets] = useState<StickerSetResponse[]>([]);
  const [isLikedListLoaded, setIsLikedListLoaded] = useState(false);
  const [originalLikedSetIds, setOriginalLikedSetIds] = useState<Set<string>>(new Set());
  const [likedCurrentPage, setLikedCurrentPage] = useState(0);
  const [likedTotalPages, setLikedTotalPages] = useState(1);
  const [isLikedLoadingMore, setIsLikedLoadingMore] = useState(false);
  const [isLoadingLiked, setIsLoadingLiked] = useState(false);
  const [likedError, setLikedError] = useState<string | null>(null);

  // ✅ FIX: Используем selector для предотвращения пересоздания функции
  const initializeLikes = useLikesStore(state => state.initializeLikes);

  /**
   * Загружает понравившиеся стикерсеты с сервера
   */
  const loadLikedStickerSets = useCallback(async (
    page: number = 0,
    isLoadMore: boolean = false
  ) => {
    if (isLoadMore) {
      setIsLikedLoadingMore(true);
    } else {
      setIsLoadingLiked(true);
    }
    setLikedError(null);

    try {
      const response = await apiClient.getLikedStickerSets(page, 20);
      const newSets = response.content || [];

      if (isLoadMore) {
        setLikedStickerSets(prev => [...prev, ...newSets]);
      } else {
        setLikedStickerSets(newSets);
        // Запоминаем ID лайкнутых наборов при первой загрузке
        const ids: Set<string> = new Set(newSets.map(s => s.id.toString()));
        setOriginalLikedSetIds(ids);
      }

      // Инициализируем лайки в store
      initializeLikes(newSets, isLoadMore);

      // Обновляем пагинацию
      setLikedCurrentPage(response.number || page);
      setLikedTotalPages(response.totalPages || 1);
      setIsLikedListLoaded(true);
    } catch (err) {
      console.error('Ошибка загрузки понравившихся:', err);
      setLikedError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setLikedStickerSets([]);
    } finally {
      if (isLoadMore) {
        setIsLikedLoadingMore(false);
      } else {
        setIsLoadingLiked(false);
      }
    }
  }, [initializeLikes]);

  /**
   * Загружает следующую страницу
   */
  const loadMoreLiked = useCallback(() => {
    if (likedCurrentPage < likedTotalPages - 1 && !isLikedLoadingMore) {
      loadLikedStickerSets(likedCurrentPage + 1, true);
    }
  }, [likedCurrentPage, likedTotalPages, isLikedLoadingMore, loadLikedStickerSets]);

  /**
   * Обновляет локальный список на основе изменений лайков в store
   */
  const updateLikedListLocally = useCallback((userStickerSets: StickerSetResponse[]) => {
    const likesState = useLikesStore.getState().likes;
    
    // Множество ID которые сейчас лайкнуты в store
    const currentlyLikedIds = new Set(
      Object.entries(likesState)
        .filter(([_, state]: [string, any]) => state.isLiked)
        .map(([id]) => id)
    );

    // Новые лайки = те что в store, но не были в оригинальном списке
    const newLikedIds = [...currentlyLikedIds].filter(
      id => !originalLikedSetIds.has(id)
    );

    // Находим стикерсеты для новых лайков из userStickerSets
    const newLikedSets = userStickerSets.filter(s =>
      newLikedIds.includes(s.id.toString())
    );

    // Удалённые лайки = те что были в оригинальном списке, но больше не лайкнуты
    const removedLikedIds = [...originalLikedSetIds].filter(
      id => !currentlyLikedIds.has(id)
    );

    // Обновляем список: удаляем unlikes, добавляем новые лайки
    setLikedStickerSets(prev => {
      const filtered = prev.filter(s =>
        !removedLikedIds.includes(s.id.toString())
      );
      return [...newLikedSets, ...filtered];
    });
  }, [originalLikedSetIds]);

  /**
   * Сбрасывает состояние
   */
  const reset = useCallback(() => {
    setLikedStickerSets([]);
    setIsLikedListLoaded(false);
    setOriginalLikedSetIds(new Set());
    setLikedCurrentPage(0);
    setLikedTotalPages(1);
    setIsLikedLoadingMore(false);
    setIsLoadingLiked(false);
    setLikedError(null);
  }, []);

  return {
    likedStickerSets,
    isLikedListLoaded,
    likedCurrentPage,
    likedTotalPages,
    isLikedLoadingMore,
    isLoadingLiked,
    likedError,
    loadLikedStickerSets,
    loadMoreLiked,
    updateLikedListLocally,
    reset
  };
}

