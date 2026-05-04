import type { TonPaymentCreateErrorBody, TonPaymentCreateMessage } from '@/api/client';

export const TON_PAY_CREATE_CODES = {
  INTENT_ALREADY_EXISTS: 'INTENT_ALREADY_EXISTS',
  SENDER_ADDRESS_MISMATCH: 'SENDER_ADDRESS_MISMATCH',
  PACKAGE_DISABLED: 'PACKAGE_DISABLED',
  TON_DISABLED: 'TON_DISABLED',
  INVALID_TON_ADDRESS: 'INVALID_TON_ADDRESS'
} as const;

/** Разбор тела ошибки после неуспешного POST /api/ton-payments/create */
export function parseTonPaymentCreateErrorBody(data: unknown): TonPaymentCreateErrorBody | null {
  if (data == null || typeof data !== 'object') return null;
  return data as TonPaymentCreateErrorBody;
}

function isLikelyTonConnectPayload(value: unknown): value is TonPaymentCreateMessage | Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return Array.isArray(r.messages) && r.messages.length > 0 && typeof r.messages[0] === 'object';
}

/**
 * Из тела конфликта RESUME — payload для TonConnect (`validUntil` + `messages[]`).
 */
export function pickResumeTonPayloadFromConflictBody(
  body: TonPaymentCreateErrorBody
): TonPaymentCreateMessage | Record<string, unknown> | null {
  const tc = body.tonConnectMessage ?? body.transaction;
  if (isLikelyTonConnectPayload(tc)) return tc;

  const raw = body as Record<string, unknown>;
  const alt = raw['sendTransactionPayload'] ?? raw['tonPaymentMessage'];
  return isLikelyTonConnectPayload(alt) ? (alt as Record<string, unknown>) : null;
}
