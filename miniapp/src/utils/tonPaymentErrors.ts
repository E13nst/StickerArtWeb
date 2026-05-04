import type { TonPaymentCreateErrorBody, TonPaymentCreateMessage } from '@/api/client';

export const TON_PAY_CREATE_CODES = {
  /** Старые бэкенды; актуальный флоу — идемпотентный 200 */
  INTENT_ALREADY_EXISTS: 'INTENT_ALREADY_EXISTS',
  SENDER_ADDRESS_MISMATCH: 'SENDER_ADDRESS_MISMATCH',
  TON_PAYMENTS_DISABLED: 'TON_PAYMENTS_DISABLED',
  MERCHANT_WALLET_NOT_CONFIGURED: 'MERCHANT_WALLET_NOT_CONFIGURED',
  UNKNOWN_CONFLICT: 'UNKNOWN_CONFLICT',
  PACKAGE_DISABLED: 'PACKAGE_DISABLED',
  TON_DISABLED: 'TON_DISABLED',
  INVALID_TON_ADDRESS: 'INVALID_TON_ADDRESS'
} as const;

/** Русский текст, если в JSON нет поля message (или только code). */
export function tonPayFallbackRuFor409Code(code: string | undefined): string | null {
  switch (code) {
    case TON_PAY_CREATE_CODES.TON_PAYMENTS_DISABLED:
      return 'Оплата в TON отключена в настройках. Выберите Stars или попробуйте позже.';
    case TON_PAY_CREATE_CODES.MERCHANT_WALLET_NOT_CONFIGURED:
      return 'Платёж TON на сервере не настроен (merchant wallet). Обратитесь в поддержку.';
    case TON_PAY_CREATE_CODES.UNKNOWN_CONFLICT:
      return 'Не удалось создать платёж в TON. Попробуйте позже или выберите другой способ оплаты.';
    default:
      return null;
  }
}

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
