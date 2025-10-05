import { useMemo } from 'react';
import { StickerSetResponse } from '@/types/sticker';

// Функция для перемешивания массива в случайном порядке
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function useStickerSetPreviews(stickerSets: StickerSetResponse[]) {
  // Предопределяем 3 случайных стикера для каждого стикерпака
  const stickerSetPreviews = useMemo(() => {
    return stickerSets.map(stickerSet => {
      const allStickers = stickerSet.telegramStickerSetInfo?.stickers || stickerSet.stickers || [];
      const shuffledStickers = shuffleArray(allStickers);
      const previewStickers = shuffledStickers.slice(0, 3);
      
      return {
        stickerSet,
        previewStickers,
        hasPreviews: previewStickers.length > 0
      };
    });
  }, [stickerSets]);

  return stickerSetPreviews;
}
