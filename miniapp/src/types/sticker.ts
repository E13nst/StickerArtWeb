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
  // Дополнительные поля для метаданных
  userId?: number;
  authorId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'HIDDEN' | 'VISIBLE' | string;
  isPublished?: boolean;
  isPrivate?: boolean;
  isBlocked?: boolean;
  blockReason?: string | null;
  blockedAt?: string | null;
  
  // Доступные действия для стикерсета (DELETE, BLOCK, UNBLOCK, PUBLISH, UNPUBLISH)
  availableActions?: string[];
  
  // Лайки - API использует разные названия полей в разных endpoints:
  // GET /stickersets возвращает:
  likesCount?: number;              // Общее количество лайков
  isLikedByCurrentUser?: boolean;   // Лайкнул ли ТЕКУЩИЙ пользователь
  
  // Для обратной совместимости (старые названия):
  likes?: number;      
  isLiked?: boolean;   
  
  categories?: Array<{
    id: number;
    key: string;
    name: string;
    description: string;
    iconUrl?: string;
    displayOrder: number;
    isActive: boolean;
  }>; // Категории стикерсета
}

export interface StickerSetPreviewResponse {
  name?: string;
  title?: string;
  telegramStickerSetInfo?: TelegramStickerSetInfo | string | null;
}

// Доп. метаданные набора (загружаются отдельно)
export interface StickerSetAuthorInfo {
  id: number;
  username?: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface StickerSetMeta {
  stickerSetId: number;
  author: StickerSetAuthorInfo;
  likes: number;
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

export interface CreateStickerSetRequest {
  userId?: number;
  title?: string;
  name: string;
  categoryKeys?: string[];
}

export interface CategorySuggestion {
  categoryKey: string;
  categoryName: string;
  confidence?: number;
  reason?: string;
}

export interface CategorySuggestionResult {
  analyzedTitle?: string;
  suggestedCategories: CategorySuggestion[];
  reasoning?: string;
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

// Новые типы для API профилей
export interface ProfileUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isPremium?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  id: number;
  userId: number;
  role: string;
  artBalance: number;
  user: ProfileUser;
  createdAt: string;
  updatedAt: string;
}

// Категории стикеров (из API)
export interface CategoryResponse {
  id: number;
  key: string;
  name: string;
  description: string;
  iconUrl?: string;
  displayOrder: number;
  isActive: boolean;
}
