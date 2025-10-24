import { StickerSetResponse } from '../types/sticker';
import { getStickerThumbnailUrl } from './stickerUtils';

export interface GalleryPack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    emoji: string;
  }>;
}

// Кэш для избежания повторных вычислений
const adapterCache = new Map<string, GalleryPack>();

export function adaptStickerSetsToGalleryPacks(stickerSets: StickerSetResponse[]): GalleryPack[] {
  return stickerSets.map(stickerSet => {
    const cacheKey = `${stickerSet.id}-${stickerSet.updatedAt}`;
    
    // Проверяем кэш
    if (adapterCache.has(cacheKey)) {
      return adapterCache.get(cacheKey)!;
    }
    
    const stickers = stickerSet.telegramStickerSetInfo?.stickers || [];
    
    // Выбираем 4 случайных стикера для превью
    const getRandomStickers = (stickers: any[], count: number) => {
      if (stickers.length === 0) return [];
      if (stickers.length <= count) return stickers;
      
      const shuffled = [...stickers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, count);
    };
    
    const randomStickers = getRandomStickers(stickers, 4);
    
    const result: GalleryPack = {
      id: stickerSet.id.toString(),
      title: stickerSet.title,
      previewStickers: randomStickers.map(sticker => ({
        fileId: sticker.file_id,
        url: getStickerThumbnailUrl(sticker.file_id),
        isAnimated: sticker.is_animated || false,
        emoji: sticker.emoji || '🎨'
      }))
    };
    
    // Сохраняем в кэш
    adapterCache.set(cacheKey, result);
    
    // Ограничиваем размер кэша
    if (adapterCache.size > 100) {
      const firstKey = adapterCache.keys().next().value;
      adapterCache.delete(firstKey);
    }
    
    return result;
  });
}
