import { StickerSetResponse } from '../types/sticker';
import { getStickerImageUrl } from './stickerUtils';

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
  // Информация о типах файлов в сете для отладки (видна только админу)
  stickerTypes?: {
    hasWebp: boolean;
    hasWebm: boolean;
    hasTgs: boolean;
  };
  // Количество стикеров в паке (видно только админу)
  stickerCount?: number;
  // Публичность стикерсета
  isPublic?: boolean;
  // Флаги блокировки и удаления
  isBlocked?: boolean;
  isDeleted?: boolean;
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
        url: getStickerImageUrl(fileId),
        isAnimated,
        isVideo,
        emoji: sticker?.emoji || '🎨'
      };
    })
    .filter((sticker): sticker is GalleryPack['previewStickers'][number] => Boolean(sticker));
};

export function adaptStickerSetsToGalleryPacks(stickerSets: StickerSetResponse[]): GalleryPack[] {
  return stickerSets.map(stickerSet => {
    // 🔥 FIX: Используем только id для кэширования, игнорируем updatedAt
    // Если данные стикерсета реально изменились, это будет другой id или перезагрузка страницы
    const cacheKey = `${stickerSet.id}`;

    if (adapterCache.has(cacheKey)) {
      const cachedPack = adapterCache.get(cacheKey)!;
      // 🔥 FIX: Возвращаем кэшированный объект со стабильными ссылками
      // Это предотвратит лишние re-renders в PackCard
      if (cachedPack.previewStickers && cachedPack.previewStickers.length > 0) {
        return cachedPack;
      }
      // Удаляем пустой кэш, чтобы попытаться собрать превью повторно
      adapterCache.delete(cacheKey);
    }

    const telegramInfo = parseTelegramInfo(stickerSet);
    const stickers = ensureStickers(telegramInfo);
    // Теперь бекенд отдает уже отобранные 3 стикера (при preview=true), используем их напрямую
    const previewCandidates = stickers.slice(0, 3);
    let previewStickers = mapToPreview(previewCandidates);

    if (previewStickers.length === 0) {
      // Попробуем использовать thumbnail ещё раз, если он есть
      const fallbackFileId = telegramInfo.thumbnail?.file_id || telegramInfo.thumbnail?.fileId;
      if (fallbackFileId) {
        previewStickers = [{
          fileId: fallbackFileId,
          url: getStickerImageUrl(fallbackFileId),
          isAnimated: false,
          isVideo: false,
          emoji: '🎨'
        }];
      }
    }

    // Определяем типы файлов в сете для отладки
    const hasWebm = stickers.some(s => s?.is_video || s?.isVideo);
    const hasTgs = stickers.some(s => s?.is_animated || s?.isAnimated);
    const hasWebp = stickers.some(s => !s?.is_video && !s?.is_animated && !s?.isVideo && !s?.isAnimated);

    // Определяем публичность стикерсета
    const isPublic = stickerSet.visibility === 'PUBLIC' || 
                     stickerSet.isPublished === true || 
                     (stickerSet as any).isPublic === true;

    const result: GalleryPack = {
      id: stickerSet.id.toString(),
      title: stickerSet.title,
      previewStickers,
      stickerTypes: {
        hasWebp,
        hasWebm,
        hasTgs
      },
      stickerCount: stickers.length,
      isPublic,
      isBlocked: stickerSet.isBlocked ?? false,
      isDeleted: false // isDeleted не приходит с бэкенда, устанавливается локально при удалении
    };

    if (previewStickers.length > 0) {
      adapterCache.set(cacheKey, result);
      if (adapterCache.size > 100) {
        const firstKey = adapterCache.keys().next().value;
        if (firstKey !== undefined) adapterCache.delete(firstKey);
      }
    } else {
      adapterCache.delete(cacheKey);
    }

    return result;
  });
}
