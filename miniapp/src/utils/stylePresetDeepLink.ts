import type { TelegramWebApp } from '@/types/telegram';

/** Префикс start_param для открытия мини-приложения с выбранным стилем (сервер: StylePresetDeepLinkParams). */
export const STYLE_PRESET_DEEP_LINK_PREFIX = 'sag_style_';

/** Реферальные параметры не считаются пресетом стиля. */
export const REFERRAL_START_PARAM_PREFIX = 'ref_';

export function parseStylePresetIdFromStartParam(raw: string | null | undefined): number | null {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t.startsWith(STYLE_PRESET_DEEP_LINK_PREFIX)) return null;
  const rest = t.slice(STYLE_PRESET_DEEP_LINK_PREFIX.length);
  if (!/^\d+$/.test(rest)) return null;
  const id = Number(rest);
  return Number.isFinite(id) && id > 0 && Number.isSafeInteger(id) ? id : null;
}

/**
 * start_param из Mini App: сначала initDataUnsafe, затем разбор сырой строки initData.
 */
export function resolveTelegramStartParam(
  tg: TelegramWebApp | null | undefined,
  initDataRaw: string | null | undefined,
): string | null {
  const fromUnsafe = typeof tg?.initDataUnsafe?.start_param === 'string' ? tg.initDataUnsafe.start_param.trim() : '';
  if (fromUnsafe.length > 0) return fromUnsafe;

  const raw = typeof initDataRaw === 'string' ? initDataRaw.trim() : '';
  if (!raw) return null;

  try {
    const params = new URLSearchParams(raw);
    const v = params.get('start_param');
    if (v != null && v.trim().length > 0) return v.trim();
  } catch {
    /* ignore */
  }
  return null;
}
