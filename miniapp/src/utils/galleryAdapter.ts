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

type TelegramStickerInfo = {
  stickers?: any[];
  thumbnail?: {
    file_id?: string;
    fileId?: string;
  };
};

const parseStickerInfo = (stickerSet: StickerSetResponse): TelegramStickerInfo => {
  const info = stickerSet.telegramStickerSetInfo as unknown;

  if (!info) {
    return {};
  }

  if (typeof info === 'string') {
    try {
      const parsed = JSON.parse(info);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('⚠️ Не удалось распарсить telegramStickerSetInfo:', error, stickerSet.id);
      return {};
    }
  }

  return info as TelegramStickerInfo;
};

const resolveFileId = (sticker: any, fallback?: { file_id?: string; fileId?: string }) => {
  return (
    sticker?.file_id ||
    sticker?.fileId ||
    sticker?.thumbnail?.file_id ||
    sticker?.thumbnail?.fileId ||
    fallback?.file_id ||
    fallback?.fileId ||
    null
  );
};

const normalizeSticker = (sticker: any, fallbackThumbnail?: { file_id?: string; fileId?: string }) => {
  const fileId = resolveFileId(sticker, fallbackThumbnail);
  if (!fileId) return null;

  return {
    fileId,
    isAnimated: Boolean(sticker?.is_animated ?? sticker?.isAnimated),
    isVideo: Boolean(sticker?.is_video ?? sticker?.isVideo),
    emoji: sticker?.emoji || '🎨'
  };
};

const buildPreviewStickers = (stickers: any[], fallbackThumbnail?: { file_id?: string; fileId?: string }) => {
  if (!Array.isArray(stickers) || stickers.length === 0) {
    const fallbackFileId = resolveFileId(undefined, fallbackThumbnail);
    if (fallbackFileId) {
      return [{
        fileId: fallbackFileId,
        url: getStickerThumbnailUrl(fallbackFileId),
        isAnimated: false,
        isVideo: false,
        emoji: '🎨'
      }];
    }
    return [];
  }

  const getRandomStickers = (source: any[], count: number) => {
    if (source.length <= count) return source;
    const shuffled = [...source];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  };

  const randomStickers = getRandomStickers(stickers, 3);
  const normalized = randomStickers
    .map(sticker => normalizeSticker(sticker, fallbackThumbnail))
    .filter((sticker): sticker is { fileId: string; isAnimated: boolean; isVideo: boolean; emoji: string } => Boolean(sticker));

  if (normalized.length === 0) {
    const fallbackFileId = resolveFileId(undefined, fallbackThumbnail);
    if (fallbackFileId) {
      return [{
        fileId: fallbackFileId,
        url: getStickerThumbnailUrl(fallbackFileId),
        isAnimated: false,
        isVideo: false,
        emoji: '🎨'
      }];
    }
  }

  return normalized.map(sticker => ({
    fileId: sticker.fileId,
    url: sticker.isVideo ? getStickerImageUrl(sticker.fileId) : getStickerThumbnailUrl(sticker.fileId),
    isAnimated: sticker.isAnimated,
    isVideo: sticker.isVideo,
    emoji: sticker.emoji
  }));
};

export function adaptStickerSetsToGalleryPacks(stickerSets: StickerSetResponse[]): GalleryPack[] {
  return stickerSets.map(stickerSet => {
    const cacheKey = `${stickerSet.id}-${stickerSet.updatedAt}`;
    
    if (adapterCache.has(cacheKey)) {
      return adapterCache.get(cacheKey)!;
    }
    
    const telegramInfo = parseStickerInfo(stickerSet);
    const previewStickers = buildPreviewStickers(telegramInfo.stickers || [], telegramInfo.thumbnail);
    
    const result: GalleryPack = {
      id: stickerSet.id.toString(),
      title: stickerSet.title,
      previewStickers
    };
    
    adapterCache.set(cacheKey, result);
    
    if (adapterCache.size > 100) {
      const firstKey = adapterCache.keys().next().value;
      adapterCache.delete(firstKey);
    }
    
    return result;
  });
}
