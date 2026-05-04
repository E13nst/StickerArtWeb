import { useState, useCallback } from 'react';
import type { TonConnectUI } from '@tonconnect/ui-react';
import { apiClient, type TonPaymentSendTransactionPayload, type TonPaymentCreateMessage } from '@/api/client';
import { useTelegram } from '@/hooks/useTelegram';

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

export interface UsePurchaseTonOptions {
  tonConnectUI: TonConnectUI | null;
  senderAddress: string | null;
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
        const created = await apiClient.createTonPayment({
          packageCode: packageCode.trim(),
          senderAddress: addr
        });

        const transaction = normalizeSendTransactionMessage(created.message);
        assertTonConnectPayloadSafe(transaction);
        await ui.sendTransaction(transaction);

        let intentId = created.intentId;
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
              const m =
                typeof failureMsgUnknown === 'string' && failureMsgUnknown
                  ? failureMsgUnknown
                  : typeof statusRes.message === 'string' && statusRes.message
                    ? statusRes.message
                    : 'Оплата отклонена';
              setError(m);
              tg?.showAlert?.(m);
              return;
            }
          } catch {
            // продолжаем polling
          }
        }

        const m = 'Время ожидания подтверждения истекло. Проверьте баланс позже.';
        setError(m);
        tg?.showAlert?.(m);
        await options.onPurchaseSuccess?.();
      } catch (err: unknown) {
        const e = err as { message?: string; response?: { status?: number; data?: { message?: string } } };
        if (e?.message?.includes('User rejected')) {
          const m = 'Вы отменили транзакцию';
          setError(m);
          tg?.showAlert?.(m);
        } else {
          const status = e?.response?.status;
          const message =
            e?.response?.data?.message || e?.message || 'Не удалось создать платёж TON';

          let userMessage = message;
          if (status === 400) userMessage = 'Неверные данные. Проверьте выбор пакета.';
          else if (status === 403) userMessage = 'Требуется авторизация.';
          else if (status === 404) userMessage = 'Пакет или платёж не найдены.';
          else if (status === 500) userMessage = 'Ошибка сервера. Попробуйте позже.';

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
      options.onPurchaseSuccess,
      tg
    ]
  );

  return { purchase, isPurchasing, error };
}
