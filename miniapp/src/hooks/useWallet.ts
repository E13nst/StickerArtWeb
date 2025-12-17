import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/client';
import { UserWallet } from '@/types/sticker';
import type { TonConnectUI } from '@tonconnect/ui-react';

/**
 * Хук для управления TON-кошельком пользователя
 * Предоставляет централизованное управление состоянием кошелька,
 * синхронизацию с бэкендом и методы для привязки/отключения
 * 
 * Backend является единственным источником истины о состоянии привязки кошелька.
 * TON Connect используется только как transport layer для получения адреса при подключении.
 */
export const useWallet = () => {
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Обновление состояния кошелька через GET /api/wallets/my
   * Запрашивает состояние кошелька с бэкенда (единственный источник истины)
   */
  const refreshWallet = useCallback(async () => {
    console.debug('[useWallet] refreshWallet: начало обновления состояния кошелька');
    setLoading(true);
    setError(null);

    try {
      const walletData = await apiClient.getMyWallet();
      console.debug('[useWallet] refreshWallet: получены данные с бэкенда', { 
        hasWallet: !!walletData,
        walletAddress: walletData?.walletAddress 
      });
      setWallet(walletData);
    } catch (err: any) {
      // Если кошелька нет на бэкенде (404) - это нормальная ситуация
      if (err?.response?.status === 404) {
        console.debug('[useWallet] refreshWallet: кошелёк не привязан (404)');
        setWallet(null);
        return;
      }
      // Другие ошибки обрабатываем
      const errorMessage = err?.message || 'Не удалось загрузить информацию о кошельке';
      console.error('[useWallet] refreshWallet: ошибка обновления кошелька', err);
      setError(errorMessage);
      // Не сбрасываем wallet при ошибке, чтобы сохранить предыдущее состояние
    } finally {
      setLoading(false);
      console.debug('[useWallet] refreshWallet: завершено');
    }
  }, []);

  /**
   * Привязка TON-кошелька к текущему пользователю
   * POST /api/wallets/link
   * После успешной привязки автоматически обновляет состояние
   */
  const linkWallet = useCallback(async (tonAddress: string, walletType?: string | null) => {
    console.debug('[useWallet] linkWallet: начало привязки', { 
      tonAddress: tonAddress?.slice(0, 6) + '...' + tonAddress?.slice(-4),
      walletType 
    });
    
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
      console.debug('[useWallet] linkWallet: кошелёк успешно привязан на бэкенде', {
        walletAddress: walletData.walletAddress?.slice(0, 6) + '...' + walletData.walletAddress?.slice(-4),
        walletType: walletData.walletType
      });
      setWallet(walletData);
      
      // Автоматически обновляем состояние для синхронизации
      await refreshWallet();
      
      return walletData;
    } catch (err: any) {
      const errorMessage = err?.message || 'Не удалось привязать кошелёк';
      console.error('[useWallet] linkWallet: ошибка привязки кошелька', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
      console.debug('[useWallet] linkWallet: завершено');
    }
  }, [refreshWallet]);

  /**
   * Отключение (деактивация) текущего активного кошелька
   * 1. Вызывает tonConnectUI.disconnect() для разрыва сессии TON Connect
   * 2. Вызывает POST /api/wallets/unlink для удаления привязки на бэкенде
   * 3. Обновляет локальное состояние
   * 
   * @param tonConnectUI - Экземпляр TonConnectUI для вызова disconnect()
   */
  const unlinkWallet = useCallback(async (tonConnectUI: TonConnectUI) => {
    console.debug('[useWallet] unlinkWallet: начало отвязки кошелька', {
      hasWallet: !!wallet,
      walletAddress: wallet?.walletAddress?.slice(0, 6) + '...' + wallet?.walletAddress?.slice(-4)
    });
    
    if (!wallet) {
      const noWalletError = 'Кошелёк не привязан';
      setError(noWalletError);
      throw new Error(noWalletError);
    }

    setLoading(true);
    setError(null);

    try {
      // Шаг 1: Разрываем сессию TON Connect
      console.debug('[useWallet] unlinkWallet: вызов tonConnectUI.disconnect()');
      await tonConnectUI.disconnect();
      console.debug('[useWallet] unlinkWallet: tonConnectUI.disconnect() выполнен успешно');
      
      // Шаг 2: Удаляем привязку на бэкенде
      console.debug('[useWallet] unlinkWallet: вызов apiClient.unlinkWallet()');
      await apiClient.unlinkWallet();
      console.debug('[useWallet] unlinkWallet: apiClient.unlinkWallet() выполнен успешно');
      
      // Шаг 3: Обновляем локальное состояние
      setWallet(null);
      console.debug('[useWallet] unlinkWallet: локальное состояние обновлено (wallet = null)');
      
      // Автоматически обновляем состояние для синхронизации
      await refreshWallet();
      console.debug('[useWallet] unlinkWallet: отвязка кошелька завершена успешно');
    } catch (err: any) {
      const errorMessage = err?.message || 'Не удалось отключить кошелёк';
      console.error('[useWallet] unlinkWallet: ошибка отключения кошелька', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
      console.debug('[useWallet] unlinkWallet: завершено');
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

