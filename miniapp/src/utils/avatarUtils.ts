import { buildStickerUrl } from './stickerUtils';

/**
 * Утилиты для работы с аватарами пользователей
 */

/**
 * Получает базовый URL API из переменных окружения или использует относительный путь
 */
const getApiBaseUrl = (): string => {
  // @ts-ignore
  const apiUrl = import.meta.env?.VITE_BACKEND_URL;
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      return url.origin;
    } catch {
      return '';
    }
  }
  return '';
};

/**
 * Строит URL для получения фото профиля через /api/users/{userId}/photo
 * @param userId - ID пользователя
 * @param fileId - file_id фотографии (опционально, если не указан, вернется основное фото)
 * @returns URL для загрузки фото профиля
 */
export const buildProfilePhotoUrl = (userId: number, fileId?: string): string => {
  if (!userId) {
    return '';
  }
  
  const baseUrl = getApiBaseUrl();
  const apiPath = baseUrl ? `${baseUrl}/api` : '/api';
  const url = `${apiPath}/users/${userId}/photo`;
  
  if (fileId) {
    return `${url}?file_id=${encodeURIComponent(fileId)}`;
  }
  
  return url;
};

/**
 * Тип для фото профиля из Telegram API
 */
export interface ProfilePhoto {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  width: number;
  height: number;
}

export interface ProfilePhotosResponse {
  total_count: number;
  photos: ProfilePhoto[][];
}

/**
 * Выбирает оптимальный размер фото профиля для аватара
 * @param profilePhotos - Массив фотографий профиля из API
 * @param targetSize - Целевой размер в пикселях (по умолчанию 160)
 * @returns file_id оптимального размера или undefined
 */
export const getOptimalAvatarFileId = (
  profilePhotos: ProfilePhotosResponse | undefined | null,
  targetSize: number = 160
): string | undefined => {
  if (!profilePhotos?.photos || profilePhotos.photos.length === 0) {
    return undefined;
  }

  // Берем первый набор фото (обычно это текущее фото профиля)
  const photoSet = profilePhotos.photos[0];
  if (!photoSet || photoSet.length === 0) {
    return undefined;
  }

  // Ищем фото, которое ближе всего к целевому размеру, но не меньше
  // Если такого нет, берем самое большое
  let bestPhoto: ProfilePhoto | null = null;
  let bestDiff = Infinity;

  for (const photo of photoSet) {
    const size = Math.min(photo.width, photo.height);
    const diff = size - targetSize;

    // Если размер подходит (>= targetSize) и ближе к целевому
    if (diff >= 0 && diff < bestDiff) {
      bestPhoto = photo;
      bestDiff = diff;
    }
  }

  // Если не нашли подходящий размер, берем самое большое
  if (!bestPhoto) {
    bestPhoto = photoSet.reduce((max, photo) => {
      const maxSize = Math.min(max.width, max.height);
      const photoSize = Math.min(photo.width, photo.height);
      return photoSize > maxSize ? photo : max;
    });
  }

  // Логирование только в dev режиме
  // @ts-ignore - import.meta.env определен в vite-env.d.ts
  if (import.meta.env?.MODE === 'development') {
    console.log('📸 Выбран размер аватара:', {
      file_id: bestPhoto.file_id,
      size: `${bestPhoto.width}x${bestPhoto.height}`,
      file_size: `${Math.round(bestPhoto.file_size / 1024)}KB`,
      targetSize
    });
  }

  return bestPhoto.file_id;
};

/**
 * Генерирует URL для загрузки аватара пользователя через /api/users/{userId}/photo
 * @param userId - ID пользователя (обязательно для фото профиля)
 * @param fileId - file_id фотографии профиля из Telegram (опционально)
 * @param profilePhotos - Опциональный массив фотографий для выбора оптимального размера
 * @param targetSize - Целевой размер в пикселях (по умолчанию 160)
 * @returns URL для загрузки изображения через /api/users/{userId}/photo
 */
export const getAvatarUrl = (
  userId: number | undefined,
  fileId: string | undefined,
  profilePhotos?: ProfilePhotosResponse | null,
  targetSize: number = 160
): string | undefined => {
  // Если нет userId, не можем построить URL для фото профиля
  if (!userId) {
    return undefined;
  }

  // Если есть массив фото, выбираем оптимальный размер
  const optimalFileId = profilePhotos
    ? getOptimalAvatarFileId(profilePhotos, targetSize)
    : fileId;

  // Если нет fileId и нет profilePhotos, возвращаем undefined
  // (API не вернет фото без file_id)
  if (!optimalFileId && !profilePhotos) {
    return undefined;
  }

  // Используем /api/users/{userId}/photo вместо /stickers/{fileId}
  // Если optimalFileId есть, передаем его как параметр, иначе API вернет основное фото
  const url = buildProfilePhotoUrl(userId, optimalFileId);
  
  // Логирование только в dev режиме
  // @ts-ignore - import.meta.env определен в vite-env.d.ts
  if (import.meta.env?.MODE === 'development') {
    console.log('🔗 URL аватара:', url, { userId, fileId: optimalFileId, hasProfilePhotos: !!profilePhotos });
  }
  return url;
};

/**
 * Генерирует инициалы из имени и фамилии пользователя
 * @param firstName - Имя пользователя
 * @param lastName - Фамилия пользователя (опционально)
 * @returns Строка с инициалами (например, "AB" или "A")
 */
export const getInitials = (firstName: string, lastName?: string): string => {
  const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
  const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
  return firstInitial + lastInitial;
};

/**
 * Генерирует цвет фона для аватара на основе имени пользователя
 * Использует хеш строки для консистентного цвета
 * @param name - Имя пользователя
 * @returns HEX цвет
 */
export const getAvatarColor = (name: string): string => {
  const colors = [
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#FF5722', // Deep Orange
    '#3F51B5', // Indigo
    '#009688', // Teal
    '#795548', // Brown
  ];

  // Простой хеш функция
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

