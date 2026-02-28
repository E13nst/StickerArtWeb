import { useState, useCallback } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { apiClient } from '@/api/client';

const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 3;

export interface UsePurchaseStarsOptions {
  onPurchaseSuccess?: () => void | Promise<void>;
}

export function usePurchaseStars(options: UsePurchaseStarsOptions = {}) {
  const { tg, isInTelegramApp } = useTelegram();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(
    async (packageCode: string) => {
      if (!packageCode?.trim()) {
        setError('Не выбран пакет');
        tg?.showAlert?.('Не выбран пакет');
        return;
      }

      if (!isInTelegramApp || !tg?.openInvoice) {
        tg?.showAlert?.('Оплата доступна только в приложении Telegram');
        return;
      }

      setError(null);
      setIsPurchasing(true);

      try {
        const { invoiceUrl } = await apiClient.createStarsInvoice(packageCode.trim());
        tg.openInvoice(invoiceUrl, async (status: string) => {
          if (status !== 'paid') {
            setIsPurchasing(false);
            return;
          }

          for (let i = 0; i < POLL_ATTEMPTS; i++) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            try {
              const purchaseData = await apiClient.getStarsPurchasesRecent();
              if (purchaseData) {
                await options.onPurchaseSuccess?.();
                setIsPurchasing(false);
                return;
              }
            } catch {
              // continue polling
            }
          }

          tg?.showAlert?.('Оплата прошла. Баланс обновится вручную при следующей загрузке профиля.');
          await options.onPurchaseSuccess?.();
          setIsPurchasing(false);
        });
      } catch (err: any) {
        const status = err?.response?.status;
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Не удалось создать платёж';

        let userMessage = message;
        if (status === 400) userMessage = 'Неверные данные. Проверьте выбор пакета.';
        else if (status === 403) userMessage = 'Требуется авторизация.';
        else if (status === 404) userMessage = 'Пакет не найден.';
        else if (status === 500) userMessage = 'Ошибка сервера. Попробуйте позже.';

        setError(userMessage);
        tg?.showAlert?.(userMessage);
        setIsPurchasing(false);
      }
    },
    [tg, isInTelegramApp, options.onPurchaseSuccess]
  );

  return { purchase, isPurchasing, error };
}
