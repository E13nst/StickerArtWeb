import { useEffect, useState } from 'react';
import { TelegramWebApp, TelegramUser } from '../types/telegram';
import WebApp from '@twa-dev/sdk';

// Mock данные для разработки вне Telegram
const createMockTelegramEnv = (): TelegramWebApp => {
  const mockUser: TelegramUser = {
    id: 123456789,
    first_name: 'Dev',
    last_name: 'User',
    username: 'devuser',
    language_code: 'ru',
    is_premium: true,
  };

  const mockInitData = `user=${encodeURIComponent(JSON.stringify(mockUser))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=mock_hash_for_development`;

  // Определяем тему на основе системных настроек
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const colorScheme = isDarkMode ? 'dark' : 'light';

  return {
    initData: mockInitData,
    initDataUnsafe: {
      user: mockUser,
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'mock_hash_for_development',
    },
    version: '7.0',
    platform: 'web',
    colorScheme: colorScheme,
    themeParams: isDarkMode ? {
      bg_color: '#18222d',
      text_color: '#ffffff',
      hint_color: '#708499',
      link_color: '#6ab2f2',
      button_color: '#5288c1',
      button_text_color: '#ffffff',
      secondary_bg_color: '#131415',
    } : {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#2481cc',
      button_color: '#2481cc',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f8f9fa',
    },
    isExpanded: true,
    viewportHeight: 600,
    viewportStableHeight: 600,
    headerColor: '#ffffff',
    backgroundColor: '#ffffff',
    isClosingConfirmationEnabled: false,
    BackButton: {
      isVisible: false,
      onClick: () => {},
      offClick: () => {},
      show: () => {},
      hide: () => {},
    },
    MainButton: {
      text: '',
      color: '#2481cc',
      textColor: '#ffffff',
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      setText: () => {},
      onClick: () => {},
      offClick: () => {},
      show: () => {},
      hide: () => {},
      enable: () => {},
      disable: () => {},
      showProgress: () => {},
      hideProgress: () => {},
      setParams: () => {},
    },
    HapticFeedback: {
      impactOccurred: () => {},
      notificationOccurred: () => {},
      selectionChanged: () => {},
    },
    ready: () => console.log('🔧 Mock Telegram готов'),
    expand: () => console.log('🔧 Mock expand'),
    close: () => console.log('🔧 Mock close'),
    sendData: () => console.log('🔧 Mock sendData'),
    switchInlineQuery: () => console.log('🔧 Mock switchInlineQuery'),
    openLink: (url: string) => window.open(url, '_blank'),
    openTelegramLink: (url: string) => console.log('🔧 Mock openTelegramLink:', url),
    openInvoice: () => console.log('🔧 Mock openInvoice'),
    showPopup: () => console.log('🔧 Mock showPopup'),
    showAlert: (message: string) => alert(message),
    showConfirm: (message: string) => confirm(message),
    showScanQrPopup: () => console.log('🔧 Mock showScanQrPopup'),
    closeScanQrPopup: () => console.log('🔧 Mock closeScanQrPopup'),
    readTextFromClipboard: () => console.log('🔧 Mock readTextFromClipboard'),
    requestWriteAccess: () => console.log('🔧 Mock requestWriteAccess'),
    requestContact: () => console.log('🔧 Mock requestContact'),
    invokeCustomMethod: () => console.log('🔧 Mock invokeCustomMethod'),
    onEvent: () => {},
    offEvent: () => {},
  } as unknown as TelegramWebApp;
};

export const useTelegram = () => {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);

  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const hasTelegramWebApp = Boolean(window.Telegram?.WebApp);
    const hasInitData = Boolean(window.Telegram?.WebApp?.initData);
    
    let telegram: TelegramWebApp;
    
    // В dev режиме без реальных данных Telegram - используем mock
    if (isDev && (!hasTelegramWebApp || !hasInitData)) {
      console.log('🔧 DEV MODE: Используется mock Telegram окружение');
      telegram = createMockTelegramEnv();
      setIsMockMode(true);
    } else {
      // Используем @twa-dev/SDK (production или real Telegram)
      telegram = WebApp as unknown as TelegramWebApp;
    }
    
    if (telegram) {
      setTg(telegram);
      setUser(telegram.initDataUnsafe?.user || null);
      setInitData(telegram.initData || '');
      
      // Инициализация Telegram Web App
      telegram.ready();
      telegram.expand();
      
      // Функция применения темы
      const applyTheme = () => {
        if (telegram.themeParams) {
          const root = document.documentElement;
          const body = document.body;
          
          // CSS переменные для темы
          root.style.setProperty('--tg-theme-bg-color', telegram.themeParams.bg_color || '#ffffff');
          root.style.setProperty('--tg-theme-text-color', telegram.themeParams.text_color || '#000000');
          root.style.setProperty('--tg-theme-hint-color', telegram.themeParams.hint_color || '#999999');
          root.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color || '#2481cc');
          root.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color || '#ffffff');
          root.style.setProperty('--tg-theme-secondary-bg-color', telegram.themeParams.secondary_bg_color || '#f8f9fa');
          root.style.setProperty('--tg-theme-link-color', telegram.themeParams.link_color || '#2481cc');
          
          // Применяем тему к body
          body.style.backgroundColor = telegram.themeParams.bg_color || '#ffffff';
          body.style.color = telegram.themeParams.text_color || '#000000';
          
          // Устанавливаем класс для темной темы
          if (telegram.colorScheme === 'dark') {
            root.classList.add('tg-dark-theme');
            root.classList.remove('tg-light-theme');
          } else {
            root.classList.add('tg-light-theme');
            root.classList.remove('tg-dark-theme');
          }
          
          console.log('🎨 Тема применена:', telegram.colorScheme);
        }
      };
      
      // Применяем тему: сначала проверяем локально сохранённую
      const savedTheme = (() => {
        try {
          const raw = localStorage.getItem('stixly_tg_theme');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      if (savedTheme?.scheme === 'dark') {
        const root = document.documentElement;
        const body = document.body;
        const params = savedTheme.params || {
          bg_color: '#18222d',
          text_color: '#ffffff',
          hint_color: '#708499',
          link_color: '#6ab2f2',
          button_color: '#5288c1',
          button_text_color: '#ffffff',
          secondary_bg_color: '#131415',
        };
        root.style.setProperty('--tg-theme-bg-color', params.bg_color);
        root.style.setProperty('--tg-theme-text-color', params.text_color);
        root.style.setProperty('--tg-theme-hint-color', params.hint_color);
        root.style.setProperty('--tg-theme-button-color', params.button_color);
        root.style.setProperty('--tg-theme-button-text-color', params.button_text_color);
        root.style.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color);
        root.style.setProperty('--tg-theme-link-color', params.link_color);
        body.style.backgroundColor = params.bg_color;
        body.style.color = params.text_color;
        root.classList.add('tg-dark-theme');
        root.classList.remove('tg-light-theme');
      } else if (savedTheme?.scheme === 'light') {
        const root = document.documentElement;
        const body = document.body;
        const params = savedTheme.params || {
          bg_color: '#ffffff',
          text_color: '#000000',
          hint_color: '#999999',
          link_color: '#2481cc',
          button_color: '#2481cc',
          button_text_color: '#ffffff',
          secondary_bg_color: '#f8f9fa',
        };
        root.style.setProperty('--tg-theme-bg-color', params.bg_color);
        root.style.setProperty('--tg-theme-text-color', params.text_color);
        root.style.setProperty('--tg-theme-hint-color', params.hint_color);
        root.style.setProperty('--tg-theme-button-color', params.button_color);
        root.style.setProperty('--tg-theme-button-text-color', params.button_text_color);
        root.style.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color);
        root.style.setProperty('--tg-theme-link-color', params.link_color);
        body.style.backgroundColor = params.bg_color;
        body.style.color = params.text_color;
        root.classList.add('tg-light-theme');
        root.classList.remove('tg-dark-theme');
      } else {
        applyTheme();
      }
      
      // Подписываемся на изменения темы
      if (typeof telegram.onEvent === 'function') {
        telegram.onEvent('themeChanged', () => {
          console.log('🎨 Тема изменилась на:', telegram.colorScheme);
          applyTheme();
        });
      }
      
      setIsReady(true);
      
      console.log('🔍 Telegram Web App данные:');
      console.log('Mode:', isMockMode ? 'MOCK' : 'PRODUCTION');
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
    isMockMode,
    checkInitDataExpiry,
    refreshInitData
  };
};
