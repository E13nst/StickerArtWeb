import { useState, useCallback } from 'react';
import axios from 'axios';
import type { TonConnectUI } from '@tonconnect/ui-react';
import {
  apiClient,
  type TonPaymentSendTransactionPayload,
  type TonPaymentCreateMessage,
  type TonPaymentCreateErrorBody,
  type TonPaymentCreateResponse
} from '@/api/client';
import { useTelegram } from '@/hooks/useTelegram';
import { tonSenderFriendlyForPayments } from '@/utils/tonAddress';
import {
  parseTonPaymentCreateErrorBody,
  pickResumeTonPayloadFromConflictBody,
  TON_PAY_CREATE_CODES,
  tonPayFallbackRuFor409Code
} from '@/utils/tonPaymentErrors';

const POLL_INTERVAL_MS = 2000;
/** ~2 минуты ожидания подтверждения после отправки транзакции */
const POLL_ATTEMPTS = 60;

function isTonPayTerminalStatus(raw: string | undefined): 'completed' | 'failed' | null {
  const s = raw?.toUpperCase()?.trim();
  if (s === 'COMPLETED') return 'completed';
  if (s === 'FAILED') return 'failed';
  return null;
}

/** Анти-подмена транзакции: только структурированный payload для Ton Connect (до вызова кошелька). */
function assertTonConnectPayloadSafe(payload: TonPaymentSendTransactionPayload): void {
  const MAX_MESSAGES = 16;
  const MAX_ADDR_CHARS = 130;
  const MAX_AMOUNT_DIGITS = 30;
  const MAX_PAYLOAD_B64_CHARS = 16_384;
  const MAX_STATEINIT_B64_CHARS = 16_384;
  const SKEW_SEC = 120;
  /** Допускаем большой допуск к будущему: бекенд может задавать далёкий validUntil. */
  const MAX_FUTURE_SEC = 10 * 365 * 86400;

  const { messages, validUntil } = payload;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new Error('Некорректные данные платежа: неверное число сообщений');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof validUntil !== 'number' || !Number.isFinite(validUntil)) {
    throw new Error('Некорректные данные платежа: недействительный срок');
  }
  if (validUntil < nowSec - SKEW_SEC) {
    throw new Error('Данные платежа устарели. Обновите и попробуйте снова.');
  }
  if (validUntil > nowSec + MAX_FUTURE_SEC) {
    throw new Error('Некорректный срок действия платежа');
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const addr =
      typeof m.address === 'string' ? (m.address as string).trim() : '';
    if (
      addr.length === 0 ||
      addr.length > MAX_ADDR_CHARS ||
      /[\x00-\x1f<>]/.test(addr)
    ) {
      throw new Error('Некорректные данные платежа: недопустимый адрес');
    }

    const amount =
      typeof m.amount === 'string' ? (m.amount as string).trim() : '';
    if (!/^\d+$/.test(amount) || amount.length > MAX_AMOUNT_DIGITS) {
      throw new Error('Некорректные данные платежа: недопустимая сумма');
    }
    if (BigInt(amount) <= 0n) {
      throw new Error('Некорректные данные платежа: нулевая сумма');
    }

    if (typeof m.payload === 'string' && m.payload.length > MAX_PAYLOAD_B64_CHARS) {
      throw new Error('Некорректные данные платежа: слишком большое тело сообщения');
    }

    if (typeof m.stateInit === 'string' && m.stateInit.length > MAX_STATEINIT_B64_CHARS) {
      throw new Error('Некорректные данные платежа: слишком большой образ контракта');
    }
  }
}

function normalizeSendTransactionMessage(
  raw: TonPaymentCreateMessage | Record<string, unknown>
): TonPaymentSendTransactionPayload {
  const o = raw as Record<string, unknown>;

  const asFull = raw as TonPaymentSendTransactionPayload;
  if (
    o &&
    typeof o === 'object' &&
    Array.isArray(asFull.messages) &&
    asFull.messages.length > 0
  ) {
    const validUntil =
      typeof asFull.validUntil === 'number'
        ? asFull.validUntil
        : Math.floor(Date.now() / 1000) + 300;
    return { validUntil, messages: asFull.messages };
  }

  // Legacy: одиночное сообщение { address, amount, payload? } без messages[]
  if (
    o &&
    typeof o === 'object' &&
    typeof o.address === 'string' &&
    typeof o.amount === 'string'
  ) {
    return {
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [
        {
          address: o.address as string,
          amount: o.amount as string,
          ...(typeof o.payload === 'string' ? { payload: o.payload as string } : {}),
          ...(typeof o.stateInit === 'string' ? { stateInit: o.stateInit as string } : {})
        }
      ]
    };
  }

  throw new Error('Некорректный ответ сервера: нет данных для транзакции');
}

/** Текст ошибки из тела POST /ton-payments/create (Spring/FastAPI по-разному) */
function readTonPayApiErrorBody(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (typeof data !== 'object') return null;
  const r = data as Record<string, unknown>;
  for (const key of ['message', 'error', 'detail', 'reason', 'description']) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function shortenTonAddr(a: string): string {
  const t = a.trim();
  if (!t) return '';
  return t.length > 14 ? `${t.slice(0, 8)}…${t.slice(-4)}` : t;
}

function resolve422TonPayMessage(body: TonPaymentCreateErrorBody): string {
  const base = typeof body.message === 'string' ? body.message.trim() : '';
  if (base) return base;
  switch (body.code) {
    case TON_PAY_CREATE_CODES.PACKAGE_DISABLED:
      return 'Этот пакет сейчас недоступен для покупки.';
    case TON_PAY_CREATE_CODES.TON_DISABLED:
      return 'Оплата в TON временно отключена.';
    case TON_PAY_CREATE_CODES.INVALID_TON_ADDRESS:
      return 'Некорректный адрес TON-кошелька.';
    default:
      return 'Запрос не выполнен. Проверьте данные и попробуйте снова.';
  }
}

export interface UsePurchaseTonOptions {
  tonConnectUI: TonConnectUI | null;
  senderAddress: string | null;
  /** То, что вернул GET /wallets/my — для совпадения строкового адреса с бэком (EQ vs UQ). */
  linkedWalletAddress?: string | null;
  onPurchaseSuccess?: () => void | Promise<void>;
}

export function usePurchaseTon(options: UsePurchaseTonOptions) {
  const { tg } = useTelegram();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(
    async (packageCode: string) => {
      const addr = options.senderAddress?.trim();
      if (!packageCode?.trim()) {
        const m = 'Не выбран пакет';
        setError(m);
        tg?.showAlert?.(m);
        return;
      }

      const ui = options.tonConnectUI;
      if (!ui) {
        const m = 'Кошелёк недоступен. Обновите страницу.';
        setError(m);
        tg?.showAlert?.(m);
        return;
      }

      if (!addr) {
        const m = 'Подключите TON-кошелёк, чтобы оплатить в TON';
        setError(m);
        tg?.showAlert?.(m);
        return;
      }

      setError(null);
      setIsPurchasing(true);

      try {
        let senderForApi: string;
        try {
          senderForApi = tonSenderFriendlyForPayments(addr, options.linkedWalletAddress);
        } catch {
          const m =
            'Неверный формат адреса кошелька. Отключите кошелёк и подключите снова.';
          setError(m);
          tg?.showAlert?.(m);
          return;
        }

        const pollIntent = async (intentId: string | number) => {
          for (let i = 0; i < POLL_ATTEMPTS; i++) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            try {
              const statusRes = await apiClient.getTonPaymentStatus(intentId);
              const outcome = isTonPayTerminalStatus(statusRes.status);
              if (outcome === 'completed') {
                await options.onPurchaseSuccess?.();
                return;
              }
              if (outcome === 'failed') {
                const failureMsgUnknown = statusRes['failureMessage'];
                const failureMessage =
                  typeof failureMsgUnknown === 'string' && failureMsgUnknown
                    ? failureMsgUnknown
                    : typeof statusRes.message === 'string' && statusRes.message
                      ? statusRes.message
                      : 'Оплата отклонена';
                setError(failureMessage);
                tg?.showAlert?.(failureMessage);
                return;
              }
            } catch {
              /* polling */
            }
          }
          const timeoutMsg =
            'Время ожидания подтверждения истекло. Проверьте баланс позже.';
          setError(timeoutMsg);
          tg?.showAlert?.(timeoutMsg);
          await options.onPurchaseSuccess?.();
        };

        const signTransactionAndPoll = async (
          intentId: string | number,
          rawMessage: TonPaymentCreateMessage | Record<string, unknown>
        ) => {
          const transaction = normalizeSendTransactionMessage(rawMessage);
          assertTonConnectPayloadSafe(transaction);
          await ui.sendTransaction(transaction);
          await pollIntent(intentId);
        };

        let created: TonPaymentCreateResponse;
        try {
          created = await apiClient.createTonPayment({
            packageCode: packageCode.trim(),
            senderAddress: senderForApi
          });
        } catch (createErr: unknown) {
          if (!axios.isAxiosError(createErr)) {
            throw createErr;
          }
          const raw = createErr.response?.data;
          const st = createErr.response?.status;
          const body = parseTonPaymentCreateErrorBody(raw);

          if (st === 409) {
            if (
              body?.code === TON_PAY_CREATE_CODES.INTENT_ALREADY_EXISTS &&
              body.canResume === true &&
              body.intentId != null
            ) {
              const resumePayload = pickResumeTonPayloadFromConflictBody(body);
              if (resumePayload) {
                await signTransactionAndPoll(body.intentId, resumePayload);
              } else {
                await pollIntent(body.intentId);
              }
              return;
            }

            if (
              body?.code === TON_PAY_CREATE_CODES.INTENT_ALREADY_EXISTS &&
              body.intentId != null &&
              body.canResume !== true
            ) {
              const m =
                readTonPayApiErrorBody(raw) ||
                body.message?.trim() ||
                'По этому пакету уже есть активный платёж в TON.';
              setError(m);
              tg?.showAlert?.(m);
              return;
            }

            if (body?.code === TON_PAY_CREATE_CODES.SENDER_ADDRESS_MISMATCH) {
              const backendMsg =
                typeof body.message === 'string' ? body.message.trim() : '';
              const exp =
                typeof body.expectedSenderAddress === 'string'
                  ? body.expectedSenderAddress.trim()
                  : '';
              const act =
                typeof body.actualSenderAddress === 'string'
                  ? body.actualSenderAddress.trim()
                  : '';
              const core =
                backendMsg ||
                'Платёж уже создан с другого адреса кошелька. Подключите тот кошелёк, с которого он был начат, или дождитесь его завершения.';
              const suffix =
                exp && act
                  ? ` Ожидалось: ${shortenTonAddr(exp)}. У вас сейчас: ${shortenTonAddr(act)}.`
                  : exp
                    ? ` Ожидался кошелёк: ${shortenTonAddr(exp)}.`
                    : '';
              const m = core + suffix;
              setError(m);
              tg?.showAlert?.(m);
              return;
            }

            if (import.meta.env.DEV) {
              console.warn('[usePurchaseTon] POST ton-payments/create 409', raw);
            }
            const fallback409 =
              readTonPayApiErrorBody(raw) ||
              tonPayFallbackRuFor409Code(body?.code) ||
              'Не удалось создать платёж в TON: возможно, уже есть незакрытое намерение оплаты.';
            setError(fallback409);
            tg?.showAlert?.(fallback409);
            return;
          }

          if (st === 422) {
            const m422 = body?.code
              ? resolve422TonPayMessage(body)
              : readTonPayApiErrorBody(raw) ||
                'Запрос отклонён: проверьте пакет и настройки оплаты.';
            setError(m422);
            tg?.showAlert?.(m422);
            return;
          }

          throw createErr;
        }

        await signTransactionAndPoll(created.intentId, created.message);
      } catch (err: unknown) {
        const e = err as { message?: string; response?: { status?: number; data?: { message?: string } } };
        if (e?.message?.includes('User rejected')) {
          const m = 'Вы отменили транзакцию';
          setError(m);
          tg?.showAlert?.(m);
        } else {
          const status =
            typeof e?.response?.status === 'number' ? e.response.status : undefined;
          const fromApi = readTonPayApiErrorBody(e?.response?.data);

          const byStatus =
            status === 400
              ? 'Неверные данные. Проверьте выбор пакета или адрес кошелька.'
              : status === 403
                ? 'Требуется авторизация.'
                : status === 404
                  ? 'Пакет или платёж не найдены.'
                  : status === 409
                    ? 'Платёж в TON не удалось создать: часто это незакрытый платёж (intent) по этому пакету. Подождите подтверждения блокчейном или откройте вкладку позже.'
                    : status === 500
                      ? 'Ошибка сервера. Попробуйте позже.'
                      : null;

          const userMessage =
            fromApi || byStatus || e?.message || 'Не удалось создать платёж TON';

          if (import.meta.env.DEV && status === 409) {
            console.warn('[usePurchaseTon] POST ton-payments/create 409', e?.response?.data);
          }

          setError(userMessage);
          tg?.showAlert?.(userMessage);
        }
      } finally {
        setIsPurchasing(false);
      }
    },
    [
      options.tonConnectUI,
      options.senderAddress,
      options.linkedWalletAddress,
      options.onPurchaseSuccess,
      tg
    ]
  );

  return { purchase, isPurchasing, error };
}
