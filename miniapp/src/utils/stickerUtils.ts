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
  // Добавляем параметр для получения файла, а не метаданных
  return `${BACKEND_URL}/api/stickers/${encodeURIComponent(fileId)}?file=true`;
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
  return `${BACKEND_URL}/api/stickers/${encodeURIComponent(fileId)}?file=true&size=${size}`;
}

