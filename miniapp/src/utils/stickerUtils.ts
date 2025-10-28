/**
 * Утилиты для работы со стикерами
 */

// Получаем BACKEND_URL из переменных окружения или используем пустую строку (относительный /api)
const getBackendUrl = (): string => {
  try {
    // @ts-ignore
    return import.meta.env.VITE_BACKEND_URL || '';
  } catch {
    return '';
  }
};

const BACKEND_URL = getBackendUrl();

/**
 * Получить URL изображения стикера по file_id
 * @param fileId - Telegram file_id стикера
 * @returns URL для загрузки изображения стикера
 */
export function getStickerImageUrl(fileId: string): string {
  if (!fileId) {
    return '';
  }
  
  // Эндпоинт для получения файла стикера через наш backend
  // Добавляем параметр для получения файла, а не метаданных
  const base = BACKEND_URL ? BACKEND_URL.replace(/\/$/, '') : '';
  return `${base}/api/proxy/stickers/${encodeURIComponent(fileId)}?file=true`;
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
  
  // Используем параметр file=true для получения изображения
  // Добавляем параметр размера для миниатюр
  const base = BACKEND_URL ? BACKEND_URL.replace(/\/$/, '') : '';
  return `${base}/api/proxy/stickers/${encodeURIComponent(fileId)}?file=true&size=${size}`;
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

