import { StickerSetResponse } from '../types/sticker';
import { getStickerThumbnailUrl, getRandomStickersFromSet } from './stickerUtils';

export interface GalleryPack {
  id: string;
  title: string;
  posters: Array<{ 
    fileId: string; 
    url: string; 
    isAnimated?: boolean;
    emoji?: string;
  }>;
  allStickers?: Array<{ 
    fileId: string; 
    url: string; 
    isAnimated?: boolean;
    emoji?: string;
  }>;
}

export function adaptStickerSetsToGalleryPacks(stickerSets: StickerSetResponse[]): GalleryPack[] {
  const result = stickerSets.map(stickerSet => {
    const allStickers = stickerSet.telegramStickerSetInfo?.stickers || [];
    
    // Используем ID стикерсета как seed для консистентного выбора
    const seed = stickerSet.id.toString();
    const randomStickers = getRandomStickersFromSet(allStickers, 4, seed);
    
    // Создаем все стикеры для выбора эмодзи
    const allStickersForEmoji = allStickers
      .filter(sticker => sticker && sticker.file_id)
      .map(sticker => ({
        fileId: sticker.file_id,
        url: getStickerThumbnailUrl(sticker.file_id),
        isAnimated: sticker.is_animated,
        emoji: sticker.emoji || '🎨'
      }));
    
    return {
      id: stickerSet.id.toString(),
      title: stickerSet.title,
      posters: randomStickers
        .filter(sticker => sticker && sticker.file_id) // Фильтруем валидные стикеры
        .map(sticker => ({
          fileId: sticker.file_id,
          url: getStickerThumbnailUrl(sticker.file_id),
          isAnimated: sticker.is_animated,
          emoji: sticker.emoji || '🎨' // Дефолтное эмодзи если нет
        })),
      allStickers: allStickersForEmoji // Передаем все стикеры для выбора эмодзи
    };
  });
  
  return result;
}
