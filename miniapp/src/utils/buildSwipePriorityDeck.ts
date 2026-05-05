import type {
  MiniAppSessionResponse,
  SessionOnboardingSlide,
  SessionPriorityBlock,
  SwipePriorityDeckCard,
} from '@/types/appSession';

/**
 * Преобразует ответ session в плоскую очередь приоритетных карточек.
 * Порядок = порядок активных блоков; внутри ONBOARDING/TERMS — порядок slides[].
 */
export function buildSwipePriorityDeck(session: MiniAppSessionResponse | null): SwipePriorityDeckCard[] {
  if (!session?.priorityBlocks?.length) return [];

  const out: SwipePriorityDeckCard[] = [];

  const pushSlides = (block: SessionPriorityBlock, slides: SessionOnboardingSlide[]) => {
    for (const slide of slides) {
      out.push({
        kind: 'priority',
        id: `pri-${block.id ?? block.type}-${slide.id}`,
        variant: 'onboarding',
        slide,
        block,
      });
    }
  };

  for (const block of session.priorityBlocks) {
    if (block.active === false) continue;

    switch (block.type) {
      case 'ONBOARDING':
      case 'TERMS':
        pushSlides(block, block.slides ?? []);
        break;
      case 'DAILY_BONUS':
        out.push({
          kind: 'priority',
          id: `pri-${block.id ?? 'daily'}`,
          variant: 'daily',
          block,
        });
        break;
      case 'STYLE_DEEPLINK': {
        const pid =
          typeof block.presetId === 'number' && block.presetId > 0
            ? block.presetId
            : session.pendingDeepLinks?.stylePresetId ?? undefined;
        if (pid == null || !Number.isFinite(pid)) break;
        out.push({
          kind: 'priority',
          id: `pri-style-${pid}`,
          variant: 'style',
          presetId: pid,
          block,
        });
        break;
      }
      default:
        out.push({
          kind: 'priority',
          id: `pri-${block.id ?? String(block.type)}`,
          variant: 'generic',
          block,
        });
    }
  }

  return out;
}
