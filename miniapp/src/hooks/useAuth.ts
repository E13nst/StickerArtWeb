import { useCallback } from 'react';
import { useTelegram } from './useTelegram';
import { useStickerStore } from '../store/useStickerStore';
import { apiClient } from '../api/client';

/**
 * Хук для управления авторизацией
 * Выносит логику авторизации из компонентов для переиспользования
 */
export const useAuth = () => {
  const { isInTelegramApp, isMockMode, checkInitDataExpiry } = useTelegram();
  const { setAuthLoading, setAuthStatus, setAuthError } = useStickerStore();

  const checkAuth = useCallback(async (initData: string) => {
    if (!isInTelegramApp && !initData) {
      console.log('✅ Режим без авторизации (dev mode)');
      setAuthStatus({
        authenticated: true,
        role: 'public'
      });
      return true;
    }
    
    if (!initData) {
      console.log('⚠️ initData отсутствует');
      setAuthStatus({
        authenticated: false,
        role: 'anonymous'
      });
      return false;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const isTestData = initData.includes('query_id=test');
      if (!isTestData) {
        const initDataCheck = checkInitDataExpiry(initData);
        if (!initDataCheck.valid) {
          throw new Error(initDataCheck.reason);
        }
      }

      apiClient.setAuthHeaders(initData);
      const authResponse = await apiClient.checkAuthStatus();
      setAuthStatus(authResponse);

      if (!authResponse.authenticated) {
        throw new Error(authResponse.message || 'Ошибка авторизации');
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setAuthError(errorMessage);
      console.error('❌ Ошибка авторизации:', error);
      
      // В dev режиме или если API недоступен - продолжаем работу
      if (isMockMode || !isInTelegramApp) {
        console.log('🔧 Продолжаем в dev режиме несмотря на ошибку API');
        setAuthStatus({
          authenticated: true,
          role: 'public'
        });
        return true;
      }
      
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [isInTelegramApp, isMockMode, checkInitDataExpiry, setAuthLoading, setAuthStatus, setAuthError]);

  return { checkAuth };
};
