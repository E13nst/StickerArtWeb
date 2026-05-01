export interface TelegramUserData {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramUserInfo {
  user: TelegramUserData;
  status: string;
}

export interface UserInfo {
  id: number;
  /** Идентификатор пользователя (для API/кэша, обычно совпадает с id или telegramId) */
  userId?: number;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string;
  artBalance: number;
  createdAt: string;
  updatedAt?: string;
  profilePhotoFileId?: string; // file_id фото профиля для загрузки через /stickers/{fileId}
  telegramUserInfo?: TelegramUserInfo; // Дополнительная информация о пользователе из Telegram (приоритетный источник данных)
  profilePhotos?: any; // Коллекция фотографий профиля
}
