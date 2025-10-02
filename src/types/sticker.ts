// Типы для стикеров и стикерсетов
export interface Sticker {
  file_id: string;
  file_unique_id: string;
  type: 'regular' | 'mask' | 'custom_emoji';
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  emoji?: string;
  set_name?: string;
  premium_animation?: {
    file_id: string;
    file_unique_id: string;
  };
  mask_position?: {
    point: 'forehead' | 'eyes' | 'mouth' | 'chin';
    x_shift: number;
    y_shift: number;
    scale: number;
  };
  custom_emoji_id?: string;
  needs_repainting?: boolean;
  file_size?: number;
}

export interface StickerSet {
  id: number;
  name: string;
  title: string;
  is_animated: boolean;
  is_video: boolean;
  contains_masks: boolean;
  stickers: Sticker[];
  thumbnail?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  };
}

export interface TelegramStickerSetInfo {
  name: string;
  title: string;
  is_animated: boolean;
  is_video: boolean;
  contains_masks: boolean;
  stickers: Sticker[];
  thumbnail?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  };
}

export interface StickerSetResponse {
  id: number;
  name: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  telegramStickerSetInfo: TelegramStickerSetInfo;
}

export interface StickerSetListResponse {
  content: StickerSetResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

export interface AuthResponse {
  authenticated: boolean;
  role?: string;
  message?: string;
  user?: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
  };
}
