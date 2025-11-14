import { useEffect, useState, useRef } from 'react';
import { TelegramWebApp, TelegramUser } from '../types/telegram';
import WebApp from '@twa-dev/sdk';

// Функция для получения реального initData из localStorage (для тестирования с ModHeader)
const getRealInitDataForTesting = (): string | null => {
  try {
    const storedInitData = localStorage.getItem('dev_telegram_init_data');
    if (storedInitData) {
      console.log('🔧 Используется реальный initData из localStorage для тестирования');
      return storedInitData;
    }
  } catch (e) {
    console.warn('Ошибка чтения dev_telegram_init_data из localStorage:', e);
  }
  return null;
};

// Mock данные для разработки вне Telegram
const createMockTelegramEnv = (realInitData?: string | null): TelegramWebApp => {
  // Если передан реальный initData, используем его
  if (realInitData) {
    const params = new URLSearchParams(realInitData);
    const userStr = params.get('user');
    
    let mockUser: TelegramUser = {
      id: 777000,
      first_name: 'Dev',
      last_name: 'User',
      username: 'devuser',
      language_code: 'ru',
      is_premium: true,
    };
    
    if (userStr) {
      try {
        const parsedUser = JSON.parse(decodeURIComponent(userStr));
        mockUser = {
          id: parsedUser.id || 777000,
          first_name: parsedUser.first_name || 'Dev',
          last_name: parsedUser.last_name || 'User',
          username: parsedUser.username || 'devuser',
          language_code: parsedUser.language_code || 'ru',
          is_premium: parsedUser.is_premium || false,
          photo_url: parsedUser.photo_url,
        };
        console.log('✅ Распарсен реальный пользователь из initData:', mockUser);
      } catch (e) {
        console.warn('Ошибка парсинга user из initData:', e);
      }
    }
    
    return {
      ...createMockTelegramEnvBase(mockUser),
      initData: realInitData,
      initDataUnsafe: {
        user: mockUser,
        auth_date: parseInt(params.get('auth_date') || `${Math.floor(Date.now() / 1000)}`),
        hash: params.get('hash') || 'mock_hash',
      },
    } as unknown as TelegramWebApp;
  }
  
  // Иначе используем стандартные mock данные
  const mockUser: TelegramUser = {
    id: 777000,
    first_name: 'Dev',
    last_name: 'User',
    username: 'devuser',
    language_code: 'ru',
    is_premium: true,
  };

  const mockInitData = `user=${encodeURIComponent(JSON.stringify(mockUser))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=mock_hash_for_development`;
  
  return {
    ...createMockTelegramEnvBase(mockUser),
    initData: mockInitData,
    initDataUnsafe: {
      user: mockUser,
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'mock_hash_for_development',
    },
  } as unknown as TelegramWebApp;
};

// Базовая конфигурация mock Telegram окружения
const createMockTelegramEnvBase = (mockUser: TelegramUser): Partial<TelegramWebApp> => {

  // Определяем тему на основе системных настроек
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const colorScheme = isDarkMode ? 'dark' : 'light';

  return {
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
  
  // Слушатель изменений системной темы
  const systemThemeListenerRef = useRef<((e: MediaQueryListEvent) => void) | null>(null);

  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const hasTelegramWebApp = Boolean(window.Telegram?.WebApp);
    const hasInitData = Boolean(window.Telegram?.WebApp?.initData);
    
    let telegram: TelegramWebApp;
    let expandTimeout: ReturnType<typeof setTimeout> | null = null;
    let handleScroll: (() => void) | null = null;
    
    // Проверяем наличие реального initData в localStorage (для тестирования с ModHeader)
    const realInitDataForTesting = getRealInitDataForTesting();
    
    // В dev режиме без реальных данных Telegram - используем mock
    if (isDev && (!hasTelegramWebApp || !hasInitData)) {
      console.log('🔧 DEV MODE: Используется mock Telegram окружение');
      telegram = createMockTelegramEnv(realInitDataForTesting);
      setIsMockMode(true);
    } else if (hasTelegramWebApp) {
      // Используем @twa-dev/SDK (production или real Telegram)
      telegram = WebApp as unknown as TelegramWebApp;
    } else {
      // В production без Telegram WebApp - используем mock
      console.log('🔧 PRODUCTION MODE: Telegram WebApp недоступен, используем mock');
      telegram = createMockTelegramEnv(realInitDataForTesting);
      setIsMockMode(true);
    }
    
    if (telegram) {
      setTg(telegram);
      setUser(telegram.initDataUnsafe?.user || null);
      setInitData(telegram.initData || '');
      
      // Инициализация Telegram Web App
      telegram.ready();
      telegram.expand();
      
      // Предотвращаем сворачивание миниаппа при скролле
      // Подписываемся на изменение viewport и автоматически расширяем обратно
      if (typeof telegram.onEvent === 'function') {
        telegram.onEvent('viewportChanged', () => {
          // Если viewport изменился и приложение свернулось - расширяем обратно
          if (!telegram.isExpanded) {
            console.log('📱 Viewport изменился, расширяем миниапп обратно');
            telegram.expand();
          }
        });
      }
      
      // Периодически вызываем expand() при скролле для предотвращения сворачивания
      handleScroll = () => {
        // Очищаем предыдущий таймаут
        if (expandTimeout) {
          clearTimeout(expandTimeout);
        }
        
        // Вызываем expand() с небольшой задержкой после скролла
        expandTimeout = setTimeout(() => {
          if (telegram && !telegram.isExpanded) {
            console.log('📱 Вызываем expand() после скролла');
            telegram.expand();
          }
        }, 100);
      };
      
      // Добавляем обработчик скролла на window
      if (handleScroll) {
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Также добавляем обработчик на touchmove для мобильных устройств
        window.addEventListener('touchmove', handleScroll, { passive: true });
      }
      
      // Устанавливаем цвета header и bottom bar в соответствии с темой
      if (telegram.setHeaderColor) {
        telegram.setHeaderColor(telegram.colorScheme === 'dark' ? 'bg_color' : 'bg_color');
      }
      
      if (telegram.setBackgroundColor) {
        telegram.setBackgroundColor(telegram.themeParams?.bg_color || '#ffffff');
      }
      
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
          
          // Дополнительные переменные для лучшей поддержки тем
          const isDark = telegram.colorScheme === 'dark';
          root.style.setProperty('--tg-theme-border-color', isDark ? '#2a3441' : '#e0e0e0');
          root.style.setProperty('--tg-theme-shadow-color', isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)');
          root.style.setProperty('--tg-theme-overlay-color', isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)');
          
          // Применяем тему к body
          body.style.backgroundColor = telegram.themeParams.bg_color || '#ffffff';
          body.style.color = telegram.themeParams.text_color || '#000000';
          
          // Устанавливаем класс для темной темы
          if (isDark) {
            root.classList.add('tg-dark-theme');
            root.classList.remove('tg-light-theme');
          } else {
            root.classList.add('tg-light-theme');
            root.classList.remove('tg-dark-theme');
          }
          
          // Сохраняем тему в localStorage
          try {
            localStorage.setItem('stixly_tg_theme', JSON.stringify({
              scheme: telegram.colorScheme,
              params: telegram.themeParams
            }));
          } catch (error) {
            console.warn('Не удалось сохранить тему в localStorage:', error);
          }
          
          // Обновляем цвета header и bottom bar при изменении темы
          if (telegram.setHeaderColor) {
            telegram.setHeaderColor(telegram.colorScheme === 'dark' ? 'bg_color' : 'bg_color');
          }
          
          if (telegram.setBackgroundColor) {
            telegram.setBackgroundColor(telegram.themeParams.bg_color || '#ffffff');
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
      
      // Слушаем изменения системной темы
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemThemeListenerRef.current = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem('stixly_tg_theme')) {
          // Применяем системную тему только если пользователь не выбрал принудительную
          console.log('🎨 Системная тема изменилась на:', e.matches ? 'dark' : 'light');
          applyTheme();
        }
      };
      
      mediaQuery.addEventListener('change', systemThemeListenerRef.current);
      
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
    
    // Cleanup функция
    return () => {
      if (systemThemeListenerRef.current) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.removeEventListener('change', systemThemeListenerRef.current);
      }
      
      // Удаляем обработчики скролла
      if (handleScroll) {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('touchmove', handleScroll);
      }
      
      // Очищаем таймаут
      if (expandTimeout) {
        clearTimeout(expandTimeout);
      }
    };
  }, []);

  const checkInitDataExpiry = (initDataString: string) => {
    if (!initDataString) {
      return { valid: false, reason: 'initData отсутствует' };
    }

    try {
      const params = new URLSearchParams(initDataString);
      const authDate = parseInt(params.get('auth_date') || '0', 10);

      if (!authDate) {
        return { valid: false, reason: 'auth_date отсутствует' };
      }

      const now = Math.floor(Date.now() / 1000);
      const age = now - authDate;
      const maxAge = 86400; // 24 часа — актуальный TTL на бэкенде

      console.log('🕐 Проверка initData:', {
        authDate,
        authDateISO: new Date(authDate * 1000).toISOString(),
        currentTimeISO: new Date(now * 1000).toISOString(),
        ageSeconds: age,
        backendTtlSeconds: maxAge
      });

      // Фронт доверяет бэкенду: всегда возвращаем valid, но логируем возможное устаревание.
      if (age > maxAge) {
        console.warn(
          '⚠️ initData старше 24 часов. Окончательное решение принимает бэкенд.'
        );
      }

      return { valid: true, age, maxAge };
    } catch (error) {
      console.error('❌ Ошибка при проверке initData:', error);
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

  // Функция для обновления цвета header
  const updateHeaderColor = (color: string) => {
    if (tg && typeof tg.setHeaderColor === 'function') {
      // Преобразуем hex цвет в формат для Telegram
      // Telegram принимает либо 'bg_color' либо hex цвет
      tg.setHeaderColor(color);
    }
  };

  return {
    tg,
    user,
    initData,
    isReady,
    isInTelegramApp,
    isMockMode,
    checkInitDataExpiry,
    refreshInitData,
    updateHeaderColor
  };
};
