import type { TelegramWebApp } from '@/types/telegram';

const TELEGRAM_HOSTNAMES = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me']);

const getTelegramWebApp = (tg?: TelegramWebApp | null): TelegramWebApp | null => {
  if (tg) {
    return tg;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
};

const hasTelegramRuntimeContext = (webApp: TelegramWebApp): boolean => {
  // Вне Telegram (mock/dev) initData обычно пустой: openTelegramLink может быть no-op.
  return typeof webApp.initData === 'string' && webApp.initData.trim().length > 0;
};

const isTelegramUrl = (url: string): boolean => {
  if (!url) {
    return false;
  }

  if (/^tg:\/\//i.test(url)) {
    return true;
  }

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://t.me');
    return TELEGRAM_HOSTNAMES.has(parsed.hostname.toLowerCase());
  } catch {
    return /^https?:\/\/t\.me\//i.test(url) || /^https?:\/\/telegram\.me\//i.test(url);
  }
};

export const openTelegramUrl = (url: string, tg?: TelegramWebApp | null): void => {
  if (!url) {
    return;
  }

  const webApp = getTelegramWebApp(tg);

  if (webApp) {
    if (
      isTelegramUrl(url) &&
      hasTelegramRuntimeContext(webApp) &&
      typeof webApp.openTelegramLink === 'function'
    ) {
      webApp.openTelegramLink(url);
      return;
    }

    if (typeof webApp.openLink === 'function') {
      webApp.openLink(url);
      return;
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
