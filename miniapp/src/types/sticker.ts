// Типы для кошельков
export interface UserWallet {
  id: number;
  walletAddress: string;
  walletType: string | null;
  isActive: boolean;
  createdAt: string;
}

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

// Лидерборд пользователей
export interface LeaderboardUser {
  userId: number;
  username: string | null;
  firstName: string;
  lastName: string;
  totalCount: number;
  publicCount: number;
  privateCount: number;
}

export interface LeaderboardResponse {
  content: LeaderboardUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Лидерборд авторов
export interface LeaderboardAuthor {
  authorId: number;
  username: string | null;
  firstName: string;
  lastName: string;
  totalCount: number;
  publicCount: number;
  privateCount: number;
}

export interface AuthorsLeaderboardResponse {
  content: LeaderboardAuthor[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Операции редактирования структуры стикерсета.
 * Используется только на фронтенде для локального состояния (Фаза 1).
 * В будущем будет отправляться на backend для применения изменений через Telegram Bot API.
 */
export interface StickerSetEditOperations {
  /**
   * Новый порядок стикеров в наборе.
   * Массив file_id в том порядке, в котором они должны быть.
   * Если не указано — порядок не меняется.
   */
  reorder?: string[];

  /**
   * Обновление эмодзи для стикеров.
   * Ключ — file_id стикера.
   * Значение — новое эмодзи.
   */
  emojiUpdates?: Record<string, string>;

  /**
   * Список file_id стикеров для удаления из набора.
   */
  deleted?: string[];
}

/**
 * Запрос на подготовку доната автору стикерсета.
 */
export interface DonationPrepareRequest {
  stickerSetId: number;
  amountNano: number;
}

/**
 * Элемент транзакции (leg) из ответа API.
 */
export interface TransactionLeg {
  id: number;
  legType: string;
  toEntityId: number;
  toWalletAddress: string;
  amountNano: number;
}

/**
 * Ответ с данными транзакции для доната.
 */
export interface DonationPrepareResponse {
  intentId: number;
  intentType: string;
  status: string;
  amountNano: number;
  currency: string;
  legs: TransactionLeg[];
}

/**
 * Запрос на подтверждение транзакции доната.
 */
export interface DonationConfirmRequest {
  intentId: number;
  txHash: string;
  fromWallet: string;
}

/**
 * Ответ на подтверждение транзакции доната.
 */
export interface DonationConfirmResponse {
  success: boolean;
  message?: string;
}