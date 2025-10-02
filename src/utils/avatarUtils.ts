/**
 * Утилиты для работы с аватарами пользователей
 */

/**
 * Генерирует URL для загрузки аватара пользователя через file_id
 * @param fileId - file_id фотографии профиля из Telegram
 * @returns URL для загрузки изображения через прокси API
 */
export const getAvatarUrl = (fileId: string | undefined): string | undefined => {
  if (!fileId || fileId.trim() === '') {
    return undefined;
  }
  return `/api/stickers/${fileId}`;
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

