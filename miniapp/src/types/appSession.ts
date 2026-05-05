/**
 * Контракт GET /api/app/session (или GET /api/mini-app/bootstrap).
 * Поля опциональны: бэкенд может отдавать частичный ответ на этапе внедрения.
 */

export type PriorityBlockType =
  | 'ONBOARDING'
  | 'TERMS'
  | 'DAILY_BONUS'
  | 'STYLE_DEEPLINK'
  | string;

export interface SessionOnboardingSlideSwipeSemantics {
  'anyDirection-dismiss'?: boolean;
  primaryButton?: string;
  [key: string]: unknown;
}

export interface SessionOnboardingSlideReferralEconomy {
  inviteeBonusArt?: number;
  referrerBonusArt?: number;
}

export interface SessionOnboardingSlide {
  id: string;
  slideType?: string;
  title?: string | null;
  bodyMarkdown?: string | null;
  imageUrl?: string | null;
  swipeSemantics?: SessionOnboardingSlideSwipeSemantics | string;
  referralEconomy?: SessionOnboardingSlideReferralEconomy;
  termsVersion?: string | null;
  termsSummaryMarkdown?: string | null;
  ctaLabel?: string | null;
  amountArt?: number | null;
}

export interface SessionPriorityBlock {
  id?: string;
  type: PriorityBlockType;
  active?: boolean;
  slides?: SessionOnboardingSlide[];
  presetId?: number;
  swipeSemantics?: Record<string, unknown>;
}

export interface SessionDailyBonus {
  claimAvailable?: boolean;
  timezone?: string | null;
  localDateForBonus?: string | null;
  streakDays?: number;
  amountIfClaim?: number;
  cooldownUntil?: string | null;
  lastClaimAt?: string | null;
}

export interface SessionReferralProfile {
  myLinkUrl?: string | null;
  inviteeBonusArt?: number;
  referrerFirstGenBonusArt?: number;
}

export interface SessionProfile {
  userId?: number;
  artBalance?: number;
  onboardingCompleted?: boolean;
  onboardingSlideIndex?: number;
  termsAccepted?: boolean;
  termsVersionRequired?: string | null;
  welcomeBonusClaimed?: boolean;
  dailyBonus?: SessionDailyBonus | null;
  referral?: SessionReferralProfile | null;
}

export interface PendingDeepLinks {
  stylePresetId?: number | null;
  state?: string | null;
}

export interface MiniAppSessionResponse {
  serverTime?: string;
  profile?: SessionProfile | null;
  pendingDeepLinks?: PendingDeepLinks | null;
  priorityBlocks?: SessionPriorityBlock[];
}

export type SwipePriorityVariant = 'onboarding' | 'daily' | 'style' | 'generic';

/** Единая модель карточки для смешанной колоды SwipePage */
export interface SwipePriorityDeckCard {
  kind: 'priority';
  id: string;
  variant: SwipePriorityVariant;
  slide?: SessionOnboardingSlide;
  presetId?: number;
  block?: SessionPriorityBlock;
}

export interface SwipeStickerDeckCard {
  kind: 'sticker';
  id: number;
  stickerSet: import('@/types/sticker').StickerSetResponse;
  feedIndex: number;
}

export type SwipePageDeckCard = SwipePriorityDeckCard | SwipeStickerDeckCard;
