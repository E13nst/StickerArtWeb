import type { DeckAction, DeckCard, DeckCardType } from '@/types/deck';

/** Вправо (положительный swipe) vs влево */
export function deckActionForGesture(type: DeckCardType, swipeRight: boolean): DeckAction {
  switch (type) {
    case 'STYLE_PRESET':
      return swipeRight ? 'LIKE' : 'DISLIKE';
    case 'WELCOME_BONUS_CLAIM':
    case 'DAILY_CHECKIN':
      return swipeRight ? 'CLAIM' : 'DISMISS';
    case 'REFERRAL_INFO':
    case 'LAST_GENERATION':
      return swipeRight ? 'OPEN' : 'DISMISS';
    case 'CREATE_STYLE_BLUEPRINT':
    case 'CUSTOM_PROMPT':
      return swipeRight ? 'PRIMARY_CTA' : 'DISMISS';
    case 'WELCOME_STEP':
    case 'SWIPE_LIMIT':
    case 'DECK_EMPTY':
      return 'DISMISS';
    default:
      return 'DISMISS';
  }
}

export function deckOverlayLabels(type: DeckCardType): { like: string; nope: string } {
  switch (type) {
    case 'STYLE_PRESET':
      return { like: '♥ LIKE', nope: '✕ PASS' };
    case 'WELCOME_BONUS_CLAIM':
    case 'DAILY_CHECKIN':
      return { like: '✓ ЗАБРАТЬ', nope: '✕ Позже' };
    case 'REFERRAL_INFO':
    case 'LAST_GENERATION':
      return { like: '→ ОТКРЫТЬ', nope: '✕ Закрыть' };
    case 'CREATE_STYLE_BLUEPRINT':
    case 'CUSTOM_PROMPT':
      return { like: '→ ДАЛЕЕ', nope: '✕ Не сейчас' };
    default:
      return { like: '✓ ОК', nope: '✕ Закрыть' };
  }
}

export interface GenerateDeckCardVisual {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkedPresetId: number | null;
}

export function buildGenerateDeckCardVisual(
  card: DeckCard,
  getLinkedPresetId: (card: DeckCard) => number | null,
): GenerateDeckCardVisual {
  const p = card.payload ?? {};
  const str = (k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
  const num = (k: string): number | null => {
    const v = p[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const imageUrl = typeof p.imageUrl === 'string' && p.imageUrl.trim() ? (p.imageUrl as string) : null;
  const linkedId = getLinkedPresetId(card);

  let title = str('title') ?? '';
  let subtitle = str('subtitle') ?? str('body') ?? str('promptPreview') ?? null;

  switch (card.type) {
    case 'STYLE_PRESET':
      if (!title) title = 'Стиль';
      break;
    case 'WELCOME_STEP':
      if (!title) title = 'Добро пожаловать';
      break;
    case 'WELCOME_BONUS_CLAIM':
      if (!title) title = 'Приветственный бонус';
      break;
    case 'DAILY_CHECKIN':
      if (!title) title = 'Ежедневный бонус';
      break;
    case 'REFERRAL_INFO':
      if (!title) title = 'Вы по реферальной ссылке';
      break;
    case 'LAST_GENERATION':
      if (!title) title = 'Последняя генерация';
      break;
    case 'CREATE_STYLE_BLUEPRINT':
      if (!title) title = 'Шаблон стиля';
      break;
    case 'CUSTOM_PROMPT':
      if (!title) title = 'Свой промпт';
      break;
    case 'SWIPE_LIMIT':
      if (!title) title = 'Лимит свайпов';
      break;
    case 'DECK_EMPTY':
      if (!title) title = 'Пока нечего оценивать';
      break;
    default:
      if (!title) title = 'Карточка';
  }

  if (num('referrerUserId') != null && card.type === 'REFERRAL_INFO' && !subtitle) {
    subtitle = `Пригласивший: id ${num('referrerUserId')}`;
  }

  return { title, subtitle, imageUrl, linkedPresetId: linkedId };
}
