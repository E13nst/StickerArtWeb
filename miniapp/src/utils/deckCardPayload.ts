import type { DeckCard } from '@/types/deck';

/**
 * Вложенный DTO ленты стилей в колоде (см. DeckService → STYLE_PRESET payload).
 * Тип payload на бэке — Map; на клиенте сужаем до записи для безопасного чтения.
 */
export function readStyleFeedItemRecord(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!payload) return null;
  const raw = payload.styleFeedItem;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/**
 * STYLE_PRESET: канон — `payload.styleFeedItem.stylePresetId` (= StylePresetDto.id).
 * Legacy: top-level `payload.stylePresetId` (если встретится в старых ответах).
 */
export function getDeckLinkedStylePresetId(card: DeckCard): number | null {
  if (card.type !== 'STYLE_PRESET') return null;
  const p = (card.payload ?? {}) as Record<string, unknown>;
  const sfi = readStyleFeedItemRecord(p);
  if (sfi && typeof sfi.stylePresetId === 'number' && Number.isFinite(sfi.stylePresetId)) {
    return sfi.stylePresetId as number;
  }
  const top = p.stylePresetId;
  if (typeof top === 'number' && Number.isFinite(top)) return top;
  return null;
}
