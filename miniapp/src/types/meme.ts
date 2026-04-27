export type CandidateFeedVisibility =
  | 'VISIBLE'
  | 'AUTO_HIDDEN'
  | 'ADMIN_HIDDEN'
  | 'ADMIN_FORCED_VISIBLE';

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
  id: number;
  userId: number;
  memeCandidateId: number;
  liked: boolean;
  disliked: boolean;
  totalLikes: number;
  totalDislikes: number;
  swipe: boolean;
}
