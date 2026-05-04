import { create } from 'zustand';

interface GenerateLandingGateState {
  /** false на /generate, пока не готов каталог + профиль + мин. задержка (логика в GeneratePage). */
  isReleased: boolean;
  reset: () => void;
  release: () => void;
}

export const useGenerateLandingGateStore = create<GenerateLandingGateState>((set) => ({
  isReleased: false,
  reset: () => set({ isReleased: false }),
  release: () => set({ isReleased: true }),
}));
