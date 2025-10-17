/**
 * Утилиты для работы с данными пользователей
 */

import { UserInfo } from '@/store/useProfileStore';

/**
 * Получает имя пользователя из приоритетного источника
 * Приоритет: telegramUserInfo.user.first_name > firstName
 */
export const getUserFirstName = (userInfo: UserInfo): string => {
  return userInfo.telegramUserInfo?.user?.first_name || userInfo.firstName || 'User';
};

/**
 * Получает фамилию пользователя из приоритетного источника
 * Приоритет: telegramUserInfo.user.last_name > lastName
 */
export const getUserLastName = (userInfo: UserInfo): string | undefined => {
  return userInfo.telegramUserInfo?.user?.last_name || userInfo.lastName;
};

/**
 * Получает username пользователя из приоритетного источника
 * Приоритет: telegramUserInfo.user.username > username
 */
export const getUserUsername = (userInfo: UserInfo): string | undefined => {
  return userInfo.telegramUserInfo?.user?.username || userInfo.username;
};

/**
 * Получает полное имя пользователя (Имя + Фамилия)
 */
export const getUserFullName = (userInfo: UserInfo): string => {
  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  return lastName ? `${firstName} ${lastName}` : firstName;
};

/**
 * Проверяет является ли пользователь премиум
 */
export const isUserPremium = (userInfo: UserInfo): boolean => {
  return userInfo.telegramUserInfo?.user?.is_premium || false;
};

/**
 * Получает ID пользователя в Telegram
 */
export const getUserTelegramId = (userInfo: UserInfo): number => {
  return userInfo.telegramUserInfo?.user?.id || userInfo.telegramId || userInfo.id;
};

