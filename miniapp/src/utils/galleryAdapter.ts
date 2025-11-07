import { StickerSetResponse } from '../types/sticker';
import { getStickerImageUrl, getStickerThumbnailUrl } from './stickerUtils';

export interface GalleryPack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    isVideo: boolean;
    emoji: string;
  }>;
}

// Кэш для избежания повторных вычислений
const adapterCache = new Map<string, GalleryPack>();

const parseStickerInfo = (stickerSet: StickerSetResponse) => {
  const info = stickerSet.telegramStickerSetInfo as unknown;

  if (!info) {
    return { stickers: [] };
  }

  if (typeof info === 'string') {
    try {
      const parsed = JSON.parse(info);
      return parsed && typeof parsed === 'object' ? parsed : { stickers: [] };
    } catch (error) {
      console.warn('⚠️ Не удалось распарсить telegramStickerSetInfo:', error, stickerSet.id);
      return { stickers: [] };
    }
  }

  return info as { stickers?: any[] };
};

export function adaptStickerSetsToGalleryPacks(stickerSets: StickerSetResponse[]): GalleryPack[] {
  return stickerSets.map(stickerSet => {
    const cacheKey = `${stickerSet.id}-${stickerSet.updatedAt}`;
    
    // Проверяем кэш
    if (adapterCache.has(cacheKey)) {
      return adapterCache.get(cacheKey)!;
    }
    
    const telegramInfo = parseStickerInfo(stickerSet);
    const stickers = Array.isArray(telegramInfo.stickers) ? telegramInfo.stickers : [];
    
    // Выбираем 3 случайных стикера для превью
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
    
    const randomStickers = getRandomStickers(stickers, 3);
    
    const result: GalleryPack = {
      id: stickerSet.id.toString(),
      title: stickerSet.title,
      previewStickers: randomStickers.map(sticker => ({
        fileId: sticker.file_id,
        url: sticker.is_video ? getStickerImageUrl(sticker.file_id) : getStickerThumbnailUrl(sticker.file_id),
        isAnimated: sticker.is_animated || false,
        isVideo: sticker.is_video || false,
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
