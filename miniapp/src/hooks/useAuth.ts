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
    console.log('🔐 Начало проверки авторизации:', {
      initData: initData ? 'present' : 'missing',
      initDataLength: initData?.length || 0,
      isInTelegramApp,
      isMockMode
    });

    if (!isInTelegramApp && !initData) {
      console.log('✅ Режим без авторизации (dev mode или production без Telegram)');
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
      console.log('🔐 Проверка initData:', {
        isTestData,
        initDataPreview: initData.substring(0, 100) + '...'
      });

      if (!isTestData) {
        const initDataCheck = checkInitDataExpiry(initData);
        console.log('🔐 Проверка срока действия initData:', initDataCheck);
        if (!initDataCheck.valid) {
          throw new Error(initDataCheck.reason);
        }
      }

      console.log('🔐 Установка заголовков авторизации...');
      apiClient.setAuthHeaders(initData);
      
      console.log('🔐 Отправка запроса проверки авторизации...');
      const authResponse = await apiClient.checkAuthStatus();
      
      console.log('🔐 Получен ответ авторизации:', authResponse);
      setAuthStatus(authResponse);

      if (!authResponse.authenticated) {
        const errorMsg = authResponse.message || 'Ошибка авторизации';
        console.error('❌ Авторизация не удалась:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Авторизация успешна');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('❌ Ошибка авторизации:', {
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        initData: initData ? 'present' : 'missing',
        isInTelegramApp,
        isMockMode
      });
      
      setAuthError(errorMessage);
      
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
