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

const parseTelegramInfo = (stickerSet: StickerSetResponse): TelegramStickerInfo => {
  const raw = stickerSet.telegramStickerSetInfo as unknown;
  if (!raw) return {};

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('⚠️ Не удалось распарсить telegramStickerSetInfo:', error, stickerSet.id);
      return {};
    }
  }

  return raw as TelegramStickerInfo;
};

const pickFileId = (sticker: any): string | null => {
  return (
    sticker?.file_id ||
    sticker?.fileId ||
    sticker?.thumbnail?.file_id ||
    sticker?.thumbnail?.fileId ||
    null
  );
};

const ensureStickers = (info: TelegramStickerInfo): any[] => {
  const stickers = Array.isArray(info.stickers) ? info.stickers : [];
  if (stickers.length > 0) return stickers;

  const fallbackFileId = info.thumbnail?.file_id || info.thumbnail?.fileId;
  if (fallbackFileId) {
    return [{ file_id: fallbackFileId, emoji: '🎨', is_video: false, is_animated: false }];
  }

  return [];
};

const mapToPreview = (stickers: any[]): GalleryPack['previewStickers'] => {
  return stickers
    .map((sticker) => {
      const fileId = pickFileId(sticker);
      if (!fileId) return null;

      const isVideo = Boolean(sticker?.is_video ?? sticker?.isVideo);
      const isAnimated = Boolean(sticker?.is_animated ?? sticker?.isAnimated);

      return {
        fileId,
        url: isVideo ? getStickerImageUrl(fileId) : getStickerThumbnailUrl(fileId),
        isAnimated,
        isVideo,
        emoji: sticker?.emoji || '🎨'
      };
    })
    .filter((sticker): sticker is GalleryPack['previewStickers'][number] => Boolean(sticker));
};

const getRandomSubset = <T,>(items: T[], count: number): T[] => {
  if (items.length <= count) return items;
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
};

export function adaptStickerSetsToGalleryPacks(stickerSets: StickerSetResponse[]): GalleryPack[] {
  return stickerSets.map(stickerSet => {
    const cacheKey = `${stickerSet.id}-${stickerSet.updatedAt}`;

    if (adapterCache.has(cacheKey)) {
      return adapterCache.get(cacheKey)!;
    }

    const telegramInfo = parseTelegramInfo(stickerSet);
    const stickers = ensureStickers(telegramInfo);
    const previewCandidates = getRandomSubset(stickers, 3);
    let previewStickers = mapToPreview(previewCandidates);

    if (previewStickers.length === 0) {
      // Попробуем использовать thumbnail ещё раз, если он есть
      const fallbackFileId = telegramInfo.thumbnail?.file_id || telegramInfo.thumbnail?.fileId;
      if (fallbackFileId) {
        previewStickers = [{
          fileId: fallbackFileId,
          url: getStickerThumbnailUrl(fallbackFileId),
          isAnimated: false,
          isVideo: false,
          emoji: '🎨'
        }];
      }
    }

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
