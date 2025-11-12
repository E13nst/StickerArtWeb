/**
 * Утилиты для работы со стикерами
 */

const readEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore
    const value = import.meta.env[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  } catch {
    return undefined;
  }
};

const STICKER_PROCESSOR_URL = readEnv('VITE_STICKER_PROCESSOR_URL');
const STICKER_PROCESSOR_PATH = readEnv('VITE_STICKER_PROCESSOR_PATH') || '/stickers';

const normalizeAbsoluteBase = (value: string): string => {
  if (!value) {
    return '';
  }
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/+$/, '');
  } catch {
    return value.replace(/\/+$/, '');
  }
};

const normalizeRelativeBase = (value: string): string => {
  if (!value) {
    return '';
  }
  const trimmed = value.replace(/\/+$/, '').trim();
  if (trimmed === '') {
    return '';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

let cachedStickerBaseUrl: string | null = null;

export const getStickerBaseUrl = (): string => {
  if (cachedStickerBaseUrl) {
    return cachedStickerBaseUrl;
  }

  if (STICKER_PROCESSOR_URL) {
    cachedStickerBaseUrl = normalizeAbsoluteBase(STICKER_PROCESSOR_URL);
    return cachedStickerBaseUrl;
  }

  cachedStickerBaseUrl = normalizeRelativeBase(STICKER_PROCESSOR_PATH);
  return cachedStickerBaseUrl;
};

const serializeQueryParams = (params: Record<string, string | number | boolean | undefined>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.append(key, String(value));
  });
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
};

export const buildStickerUrl = (
  fileId: string,
  params: Record<string, string | number | boolean | undefined> = {}
): string => {
  if (!fileId) {
    return '';
  }

  const base = getStickerBaseUrl();
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const query = serializeQueryParams(params);
  return `${normalizedBase}/${encodeURIComponent(fileId)}${query}`;
};

/**
 * Получить URL изображения стикера по file_id
 * @param fileId - Telegram file_id стикера
 * @returns URL для загрузки изображения стикера
 */
export function getStickerImageUrl(fileId: string): string {
  if (!fileId) {
    return '';
  }
  return buildStickerUrl(fileId, { file: true });
}

/**
 * Получить URL миниатюры стикера (для превью в списках)
 * @param fileId - Telegram file_id стикера
 * @param size - Размер миниатюры (по умолчанию 128x128)
 * @returns URL для загрузки миниатюры
 */
export function getStickerThumbnailUrl(fileId: string, size: number = 128): string {
  if (!fileId) {
    return '';
  }
  return buildStickerUrl(fileId, { file: true, size });
}

/**
 * Получить случайные стикеры из набора
 * @param stickers - Массив стикеров
 * @param count - Количество стикеров для выбора
 * @param seed - Опциональный seed для детерминированного выбора
 * @returns Массив случайно выбранных стикеров
 */
export function getRandomStickersFromSet<T>(
  stickers: T[], 
  count: number, 
  seed?: string
): T[] {
  if (!stickers || stickers.length === 0) return [];
  
  // Фильтруем валидные стикеры (не null/undefined)
  const validStickers = stickers.filter(sticker => sticker != null);
  if (validStickers.length === 0) return [];
  
  // Если валидных стикеров меньше или равно нужному количеству, возвращаем все
  if (validStickers.length <= count) {
    return [...validStickers];
  }
  
  // Создаем копию массива для перемешивания
  const shuffledStickers = [...validStickers];
  
  if (seed) {
    // Детерминированное перемешивание с seed
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
      state = ((state << 5) - state + seed.charCodeAt(i)) & 0xffffffff;
    }
    
    const seededRandom = () => {
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      return state / 0x100000000;
    };
    
    // Fisher-Yates shuffle с seeded random
    for (let i = shuffledStickers.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [shuffledStickers[i], shuffledStickers[j]] = [shuffledStickers[j], shuffledStickers[i]];
    }
  } else {
    // Полностью случайное перемешивание
    for (let i = shuffledStickers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledStickers[i], shuffledStickers[j]] = [shuffledStickers[j], shuffledStickers[i]];
    }
  }
  
  return shuffledStickers.slice(0, count);
}

