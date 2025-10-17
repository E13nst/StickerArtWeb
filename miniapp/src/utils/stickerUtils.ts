/**
 * Утилиты для работы со стикерами
 */

// Получаем BACKEND_URL из переменных окружения или используем значение по умолчанию
const getBackendUrl = (): string => {
  try {
    // @ts-ignore
    return import.meta.env.VITE_BACKEND_URL || 'https://stickerartgallery-e13nst.amvera.io';
  } catch {
    return 'https://stickerartgallery-e13nst.amvera.io';
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
  return `${BACKEND_URL}/api/stickers/${encodeURIComponent(fileId)}`;
}

/**
 * Получить URL миниатюры стикера (для превью в списках)
 * @param fileId - Telegram file_id стикера
 * @returns URL для загрузки миниатюры
 */
export function getStickerThumbnailUrl(fileId: string): string {
  // Используем тот же эндпоинт - backend может сам оптимизировать размер
  return getStickerImageUrl(fileId);
}

