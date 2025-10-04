// Пустые данные - приложение работает только с реальным API
import { StickerSetResponse } from '@/types/sticker';

// Пустой массив - никаких тестовых данных
export const mockStickerSets: StickerSetResponse[] = [];

export const mockUserStickerSets: StickerSetResponse[] = [];

// Пустой ответ аутентификации
export const mockAuthResponse = {
  authenticated: false,
  role: null,
  user: null
};