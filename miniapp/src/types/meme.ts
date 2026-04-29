export type CandidateFeedVisibility =
  | 'VISIBLE'
  | 'AUTO_HIDDEN'
  | 'ADMIN_HIDDEN'
  | 'ADMIN_FORCED_VISIBLE';

/** Карточка ленты стилей (style-feed); имя типа сохранено для совместимости с компонентами. */
export interface MemeCandidateDto {
  id: number;
  taskId: string;
  cachedImageId: string;
  imageUrl: string | null;
  stylePresetId: number | null;
  stylePresetName: string | null;
  presetOwnerUserId: number | null;
  likesCount: number;
  dislikesCount: number;
  visibility: CandidateFeedVisibility;
  createdAt: string;
}

export interface MemeCandidateVoteResponseDto {
  /** Идентификатор записи ленты (актуальный ключ для API style-feed). */
  styleFeedItemId?: number;
  /** Совместимость со старыми ответами бэкенда */
  memeCandidateId?: number;
  id?: number;
  userId: number;
  liked: boolean;
  disliked: boolean;
  totalLikes: number;
  totalDislikes: number;
  swipe: boolean;
}
