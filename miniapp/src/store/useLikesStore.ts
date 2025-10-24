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
  getLikeState: (packId: string) => LikeState;
  isLiked: (packId: string) => boolean;
  getLikesCount: (packId: string) => number;
}

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
      }
    }),
    {
      name: 'likes-storage',
      partialize: (state) => ({
        likes: state.likes
      })
    }
  )
);

