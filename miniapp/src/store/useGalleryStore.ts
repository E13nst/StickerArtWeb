import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GalleryState {
  seed: string;
  shuffledPackIds: string[];
  postersByPack: Record<string, string[]>;
  scrollY: number;
  setSeed: (seed: string) => void;
  setShuffledPackIds: (ids: string[]) => void;
  setPostersByPack: (packId: string, posterIds: string[]) => void;
  setScrollY: (scrollY: number) => void;
  reset: () => void;
}

export const useGalleryStore = create<GalleryState>()(
  persist(
    (set, get) => ({
      seed: '',
      shuffledPackIds: [],
      postersByPack: {},
      scrollY: 0,
      
      setSeed: (seed: string) => {
        const currentSeed = get().seed;
        if (currentSeed !== seed) {
          set({ seed });
        }
      },
      
      setShuffledPackIds: (shuffledPackIds: string[]) => {
        const currentShuffledPackIds = get().shuffledPackIds;
        if (JSON.stringify(currentShuffledPackIds) !== JSON.stringify(shuffledPackIds)) {
          set({ shuffledPackIds });
        }
      },
      
      setPostersByPack: (packId: string, posterIds: string[]) =>
        set((state) => {
          const currentPosterIds = state.postersByPack[packId];
          if (JSON.stringify(currentPosterIds) !== JSON.stringify(posterIds)) {
            return {
              postersByPack: {
                ...state.postersByPack,
                [packId]: posterIds
              }
            };
          }
          return state;
        }),
      
      setScrollY: (scrollY: number) => {
        const currentScrollY = get().scrollY;
        if (currentScrollY !== scrollY) {
          set({ scrollY });
        }
      },
      
      reset: () => set({
        seed: '',
        shuffledPackIds: [],
        postersByPack: {},
        scrollY: 0
      })
    }),
    {
      name: 'gallery-storage',
      partialize: (state) => ({
        shuffledPackIds: state.shuffledPackIds,
        postersByPack: state.postersByPack,
        scrollY: state.scrollY
      })
    }
  )
);

// Отдельное хранение seed в sessionStorage
export const getSessionSeed = (): string => {
  return sessionStorage.getItem('gallery-seed') || '';
};

export const setSessionSeed = (seed: string): void => {
  sessionStorage.setItem('gallery-seed', seed);
};




