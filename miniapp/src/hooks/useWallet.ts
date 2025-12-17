import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/client';
import { UserWallet } from '@/types/sticker';

/**
 * Хук для управления TON-кошельком пользователя
 * Предоставляет централизованное управление состоянием кошелька,
 * синхронизацию с бэкендом и методы для привязки/отключения
 * 
 * @param tonAddress - Текущий адрес кошелька из TON Connect (для синхронизации состояния)
 */
export const useWallet = (tonAddress?: string | null) => {
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Обновление состояния кошелька через GET /api/wallets/my
   * Синхронизирует состояние фронта с бэкендом
   * Автоматически отвязывает кошелек на бэкенде, если он отвязан в TON Connect
   */
  const refreshWallet = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Если кошелек отвязан в TON Connect, проверяем и синхронизируем состояние на бэкенде
      if (tonAddress === null || tonAddress === undefined) {
        try {
          const walletData = await apiClient.getMyWallet();
          // Если кошелек есть на бэкенде, но отвязан в TON Connect - синхронизируем
          if (walletData) {
            console.log('🔄 Кошелек отвязан в TON Connect, синхронизируем с бэкендом...');
            await apiClient.unlinkWallet();
            setWallet(null);
            console.log('✅ Кошелек отвязан на бэкенде');
            return;
          }
        } catch (err: any) {
          // Если кошелька нет на бэкенде (404) - это нормальная ситуация
          if (err?.response?.status === 404) {
            setWallet(null);
            return;
          }
          // Другие ошибки пробрасываем дальше для обработки
          throw err;
        }
        // Если дошли сюда - кошелька нет, устанавливаем null
        setWallet(null);
        return;
      }

      // Если tonAddress есть - загружаем данные как обычно
      const walletData = await apiClient.getMyWallet();
      setWallet(walletData);
      console.log('✅ Состояние кошелька обновлено:', walletData);
    } catch (err: any) {
      const errorMessage = err?.message || 'Не удалось загрузить информацию о кошельке';
      console.error('❌ Ошибка обновления кошелька:', err);
      setError(errorMessage);
      // Не сбрасываем wallet при ошибке, чтобы сохранить предыдущее состояние
    } finally {
      setLoading(false);
    }
  }, [tonAddress]);

  /**
   * Привязка TON-кошелька к текущему пользователю
   * POST /api/wallets/link
   * После успешной привязки автоматически обновляет состояние
   */
  const linkWallet = useCallback(async (tonAddress: string, walletType?: string | null) => {
    // Валидация адреса кошелька
    if (!tonAddress || tonAddress.length !== 48) {
      const validationError = 'Адрес кошелька должен быть 48 символов';
      setError(validationError);
      throw new Error(validationError);
    }

    const prefix = tonAddress.substring(0, 2);
    if (!['EQ', 'UQ', 'kQ'].includes(prefix)) {
      const validationError = 'Адрес кошелька должен начинаться с EQ, UQ или kQ';
      setError(validationError);
      throw new Error(validationError);
    }

    setLoading(true);
    setError(null);

    try {
      const walletData = await apiClient.linkWallet(tonAddress, walletType);
      setWallet(walletData);
      console.log('✅ Кошелёк успешно привязан:', walletData);
      
      // Автоматически обновляем состояние для синхронизации
      await refreshWallet();
      
      return walletData;
    } catch (err: any) {
      const errorMessage = err?.message || 'Не удалось привязать кошелёк';
      console.error('❌ Ошибка привязки кошелька:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshWallet]);

  /**
   * Отключение (деактивация) текущего активного кошелька
   * POST /api/wallets/unlink
   * После успешного отключения автоматически обновляет состояние
   */
  const unlinkWallet = useCallback(async () => {
    if (!wallet) {
      const noWalletError = 'Кошелёк не привязан';
      setError(noWalletError);
      throw new Error(noWalletError);
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.unlinkWallet();
      setWallet(null);
      console.log('✅ Кошелёк успешно отключен');
      
      // Автоматически обновляем состояние для синхронизации
      await refreshWallet();
    } catch (err: any) {
      const errorMessage = err?.message || 'Не удалось отключить кошелёк';
      console.error('❌ Ошибка отключения кошелька:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, refreshWallet]);

  // Автоматическая загрузка кошелька при монтировании компонента
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  return {
    wallet,
    loading,
    error,
    linkWallet,
    unlinkWallet,
    refreshWallet
  };
};

