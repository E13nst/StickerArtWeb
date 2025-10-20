import { StickerSetResponse } from '../types/sticker';
import { getStickerThumbnailUrl } from './stickerUtils';

export interface GalleryPack {
  id: string;
  title: string;
  posters: Array<{ 
    fileId: string; 
    url: string; 
    isAnimated?: boolean;
    emoji?: string;
  }>;
}

export function adaptStickerSetsToGalleryPacks(stickerSets: StickerSetResponse[]): GalleryPack[] {
  const result = stickerSets.map(stickerSet => ({
    id: stickerSet.id.toString(),
    title: stickerSet.title,
    posters: (stickerSet.telegramStickerSetInfo?.stickers || [])
      .slice(0, 4) // Берем только первые 4 стикера
      .map(sticker => ({
        fileId: sticker.file_id,
        url: getStickerThumbnailUrl(sticker.file_id),
        isAnimated: sticker.is_animated,
        emoji: sticker.emoji
      }))
  }));
  
  return result;
}
