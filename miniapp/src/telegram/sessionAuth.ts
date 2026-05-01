import { apiClient } from '@/api';
import { readDevTelegramInitDataOverride } from '@/telegram/launchParams';
import { setInitData } from '@/utils/auth';

/**
 * Синхронизирует auth-контекст Telegram между apiClient и глобальным initData.
 * Возвращает эффективный merged initData (или null, если контекст пустой).
 */
export function applyTelegramSessionAuth(
  telegramInitData: string | null | undefined,
  languageCode?: string | null,
): string | null {
  const trimmed = (telegramInitData || '').trim();
  const devOverride = readDevTelegramInitDataOverride();

  // Пустой Telegram init и нет dev-строки — не затираем цепочку в client.
  if (!trimmed && !devOverride) {
    setInitData(null);
    return null;
  }

  // Приоритет dev_telegram_init_data внутри apiClient.setAuthHeaders / interceptor / getMergedInitDataRaw
  apiClient.setAuthHeaders(trimmed, languageCode ?? undefined);
  const merged = apiClient.getMergedInitDataRaw();
  setInitData(merged);
  return merged;
}
