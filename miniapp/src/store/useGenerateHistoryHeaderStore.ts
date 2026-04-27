import { create } from 'zustand';

/** Слот правой кнопки шапки на странице /generate (вместо Wallet). */
export type GenerateHistoryHeaderSlot = {
  previewImageUrl: string | null;
  /** Превью эмодзи из последней записи или 🕘, если нет картинки */
  fallbackEmoji: string;
  open: boolean;
  toggle: () => void;
};

type State = {
  slot: GenerateHistoryHeaderSlot | null;
  setSlot: (slot: GenerateHistoryHeaderSlot | null) => void;
};

export const useGenerateHistoryHeaderStore = create<State>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
}));
