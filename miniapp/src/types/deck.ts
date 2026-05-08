import type { SwipeStatsResponse, SwipeLimitError } from '@/types/sticker';

export type DeckCardType =
  | 'WELCOME_STEP'
  | 'WELCOME_BONUS_CLAIM'
  | 'DAILY_CHECKIN'
  | 'REFERRAL_INFO'
  | 'LAST_GENERATION'
  | 'CREATE_STYLE_BLUEPRINT'
  | 'CUSTOM_PROMPT'
  | 'STYLE_PRESET'
  | 'SWIPE_LIMIT'
  | 'DECK_EMPTY';

export type DeckAction =
  | 'LIKE'
  | 'DISLIKE'
  | 'DISMISS'
  | 'CLAIM'
  | 'OPEN'
  | 'PRIMARY_CTA';

export type DeckCardPayload = Record<string, unknown>;

export interface DeckCard {
  cardInstanceId: string;
  type: DeckCardType;
  payload?: DeckCardPayload;
  /** Если бэкенд отдаёт список допустимых действий */
  actions?: DeckAction[];
}

export interface DeckProgress {
  styleSwipesInCurrentRun: number;
  swipesRequiredForDeckReward: number;
  swipesRemainingUntilDeckReward: number;
  premium: boolean;
  deckCompletionsTotal: number;
}

export interface DeckCardsResponse {
  cards: DeckCard[];
  swipeStats: SwipeStatsResponse;
  deckProgress: DeckProgress;
}

export interface DeckActionResponse {
  success: boolean;
  artDelta?: number;
  balanceAfter?: number;
  deckProgress?: DeckProgress;
  swipeStats?: SwipeStatsResponse;
  message?: string;
}

/** Ответ ошибки лимита при deck action (HTTP 429), тот же контракт что style-feed */
export type DeckLimitErrorBody = SwipeLimitError;
