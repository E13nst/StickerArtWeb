import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LikeState {
  packId: string;
  isLiked: boolean;
  likesCount: number;
}

interface LikesStore {
  likes: Record<string, LikeState>;
  toggleLike: (packId: string) => void;
  setLike: (packId: string, isLiked: boolean, likesCount?: number) => void;
  initializeLikes: (stickerSets: Array<{ id: number; likes?: number }>) => void;
  getLikeState: (packId: string) => LikeState;
  isLiked: (packId: string) => boolean;
  getLikesCount: (packId: string) => number;
  clearStorage: () => void;
}

// Версия storage - при изменении будут очищены старые данные
const STORAGE_VERSION = 2;

export const useLikesStore = create<LikesStore>()(
  persist(
    (set, get) => ({
      likes: {},

      toggleLike: (packId: string) => {
        const currentState = get().likes[packId];
        const newIsLiked = !currentState?.isLiked;
        const newLikesCount = (currentState?.likesCount || 0) + (newIsLiked ? 1 : -1);

        set((state) => ({
          likes: {
            ...state.likes,
            [packId]: {
              packId,
              isLiked: newIsLiked,
              likesCount: Math.max(0, newLikesCount)
            }
          }
        }));
      },

      setLike: (packId: string, isLiked: boolean, likesCount?: number) => {
        set((state) => ({
          likes: {
            ...state.likes,
            [packId]: {
              packId,
              isLiked,
              likesCount: likesCount ?? (state.likes[packId]?.likesCount || 0)
            }
          }
        }));
      },

      initializeLikes: (stickerSets: Array<{ id: number; likes?: number }>) => {
        set((state) => {
          // Используем Map для эффективного batch обновления
          const updates = new Map<string, LikeState>();
          
          // Список ID стикерсетов из API
          const apiIds = new Set(stickerSets.map(s => s.id.toString()));
          
          // Удаляем записи, которых нет в API
          const filteredLikes: Record<string, LikeState> = {};
          Object.entries(state.likes).forEach(([packId, likeState]) => {
            if (apiIds.has(packId)) {
              filteredLikes[packId] = likeState;
            }
          });
          
          stickerSets.forEach(stickerSet => {
            // Инициализируем только если API предоставляет актуальные данные о лайках
            if (stickerSet.likes !== undefined) {
              const packId = stickerSet.id.toString();
              updates.set(packId, {
                packId,
                isLiked: filteredLikes[packId]?.isLiked || false,
                likesCount: stickerSet.likes
              });
            }
          });
          
          // Одно обновление вместо N отдельных обновлений
          if (updates.size === 0) return { likes: filteredLikes };
          
          return {
            likes: Object.assign({}, filteredLikes, Object.fromEntries(updates))
          };
        });
      },

      getLikeState: (packId: string) => {
        return get().likes[packId] || {
          packId,
          isLiked: false,
          likesCount: 0
        };
      },

      isLiked: (packId: string) => {
        return get().likes[packId]?.isLiked || false;
      },

      getLikesCount: (packId: string) => {
        return get().likes[packId]?.likesCount || 0;
      },

      clearStorage: () => {
        // Очищаем только данные о лайках, но оставляем метаданные zustand
        set({ likes: {} });
      }
    }),
    {
      name: 'likes-storage',
      version: STORAGE_VERSION,
      partialize: (state) => ({
        likes: state.likes
      })
    }
  )
);



