import { useEffect, useState } from 'react';
import { TelegramWebApp, TelegramUser } from '@/types/telegram';

export const useTelegram = () => {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    
    if (telegram) {
      setTg(telegram);
      setUser(telegram.initDataUnsafe?.user || null);
      setInitData(telegram.initData || '');
      
      // Инициализация Telegram Web App
      telegram.ready();
      telegram.expand();
      
      // Настройка темы
      if (telegram.themeParams) {
        const root = document.documentElement;
        root.style.setProperty('--tg-theme-bg-color', telegram.themeParams.bg_color || '#ffffff');
        root.style.setProperty('--tg-theme-text-color', telegram.themeParams.text_color || '#000000');
        root.style.setProperty('--tg-theme-hint-color', telegram.themeParams.hint_color || '#999999');
        root.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color || '#2481cc');
        root.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color || '#ffffff');
        root.style.setProperty('--tg-theme-secondary-bg-color', telegram.themeParams.secondary_bg_color || '#f8f9fa');
      }
      
      setIsReady(true);
      
      console.log('🔍 Telegram Web App данные:');
      console.log('tg.initData:', telegram.initData ? `present (${telegram.initData.length} chars)` : 'null');
      console.log('tg.initDataUnsafe:', telegram.initDataUnsafe);
      console.log('user:', telegram.initDataUnsafe?.user);
      console.log('platform:', telegram.platform);
      console.log('version:', telegram.version);
      
      // Детальная отладка initData
      if (telegram.initData) {
        console.log('🔍 Детальный разбор initData:');
        const params = new URLSearchParams(telegram.initData);
        for (const [key, value] of params.entries()) {
          console.log(`  ${key}:`, value);
        }
      }
    } else {
      console.warn('⚠️ Telegram Web App не доступен');
      setIsReady(true);
    }
  }, []);

  const checkInitDataExpiry = (initDataString: string) => {
    if (!initDataString) return { valid: false, reason: 'initData отсутствует' };
    
    try {
      const params = new URLSearchParams(initDataString);
      const authDate = parseInt(params.get('auth_date') || '0');
      
      if (!authDate) {
        return { valid: false, reason: 'auth_date отсутствует' };
      }
      
      const now = Math.floor(Date.now() / 1000);
      const age = now - authDate;
      const maxAge = 600; // 10 минут
      
      console.log('🕐 Проверка срока действия initData:');
      console.log('auth_date:', authDate, `(${new Date(authDate * 1000).toLocaleString()})`);
      console.log('current time:', now, `(${new Date(now * 1000).toLocaleString()})`);
      console.log('age:', age, 'секунд');
      console.log('max age:', maxAge, 'секунд');
      
      if (age > maxAge) {
        return { 
          valid: false, 
          reason: `initData устарел (возраст: ${age} сек, максимум: ${maxAge} сек)`,
          age: age,
          maxAge: maxAge
        };
      }
      
      return { valid: true, age: age, maxAge: maxAge };
    } catch (error) {
      console.error('❌ Ошибка при проверке срока действия initData:', error);
      return { valid: false, reason: `Ошибка парсинга initData: ${error}` };
    }
  };

  const refreshInitData = () => {
    if (!tg) return false;
    
    console.log('🔄 Попытка обновления initData...');
    
    const newUser = tg.initDataUnsafe?.user;
    const newInitData = tg.initData;
    
    if (newInitData && newInitData !== initData) {
      console.log('✅ initData обновлен');
      setUser(newUser || null);
      setInitData(newInitData);
      return true;
    } else {
      console.log('❌ initData не изменился');
      return false;
    }
  };

  const isInTelegramApp = Boolean(tg && initData && initData.trim() !== '');

  return {
    tg,
    user,
    initData,
    isReady,
    isInTelegramApp,
    checkInitDataExpiry,
    refreshInitData
  };
};
