import type { AxiosInstance } from 'axios';
import { getInitData, readDevTelegramInitDataOverride } from '@/telegram/launchParams';

export type InitDataHeaderSource =
  | 'request'
  | 'dev_localStorage'
  | 'defaults'
  | 'getInitData()'
  | 'missing';

export function initializeAuthFromLocalStorage(
  setAuthHeaders: (initData: string, language?: string) => void,
): void {
  try {
    const storedInitData = localStorage.getItem('dev_telegram_init_data');
    if (storedInitData) {
      console.log('🔐 Используется initData из localStorage для API запросов');
      setAuthHeaders(storedInitData);
    }
  } catch (e) {
    console.warn('Ошибка чтения dev_telegram_init_data из localStorage:', e);
  }
}

export function resolveEffectiveInitDataRawForRequests(client: AxiosInstance): string | null {
  const dev = readDevTelegramInitDataOverride();
  if (dev) return dev;

  const common = client.defaults.headers.common;
  const main = common['X-Telegram-Init-Data'] as string | undefined;
  if (typeof main === 'string' && main.trim().length > 0) return main.trim();

  return getInitData();
}

export function detectInitDataSource(
  client: AxiosInstance,
  resolvedInitData: string | null,
): InitDataHeaderSource {
  if (!resolvedInitData) return 'missing';
  const dev = readDevTelegramInitDataOverride();
  const defaults = client.defaults.headers.common['X-Telegram-Init-Data'] as string | undefined;
  if (dev && dev === resolvedInitData) return 'dev_localStorage';
  if (typeof defaults === 'string' && defaults.trim() === resolvedInitData) return 'defaults';
  return 'getInitData()';
}

export function resolveAuthHeaderInput(initData: string): {
  effectiveInitData: string;
  hasDevOverride: boolean;
} {
  const dev = readDevTelegramInitDataOverride();
  if (dev) {
    return { effectiveInitData: dev, hasDevOverride: true };
  }
  return { effectiveInitData: initData, hasDevOverride: false };
}
