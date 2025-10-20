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
      
      setSeed: (seed: string) => set({ seed }),
      
      setShuffledPackIds: (shuffledPackIds: string[]) => 
        set({ shuffledPackIds }),
      
      setPostersByPack: (packId: string, posterIds: string[]) =>
        set((state) => ({
          postersByPack: {
            ...state.postersByPack,
            [packId]: posterIds
          }
        })),
      
      setScrollY: (scrollY: number) => set({ scrollY }),
      
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

