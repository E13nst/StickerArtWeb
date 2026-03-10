import { useEffect, useState, useRef } from 'react';
import { TelegramWebApp, TelegramUser } from '../types/telegram';
import WebApp from '@twa-dev/sdk';
import { setupTelegramViewportSafe } from '../utils/setupTelegramViewport';

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

// Базовая конфигурация mock Telegram окружения (единый вид на всех устройствах)
const createMockTelegramEnvBase = (_mockUser: TelegramUser): Partial<TelegramWebApp> => {
  return {
    version: '7.0',
    platform: 'web',
    colorScheme: 'dark',
    themeParams: {
      bg_color: '#191818',
      text_color: '#ffffff',
      hint_color: '#708499',
      link_color: '#6ab2f2',
      button_color: '#5288c1',
      button_text_color: '#ffffff',
      secondary_bg_color: '#131415',
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
      color: '#ee449f',
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
    switchInlineQuery: (query: string) => {
      console.log('🔧 Mock switchInlineQuery:', query);
      // В mock режиме открываем fallback URL
      const shareUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(query)}`;
      window.open(shareUrl, '_blank');
    },
    openLink: (url: string) => window.open(url, '_blank'),
    openTelegramLink: (url: string) => console.log('🔧 Mock openTelegramLink:', url),
    openInvoice: (url: string, callback?: (status: string) => void) => {
      console.log('🔧 Mock openInvoice', url);
      callback?.('cancelled');
    },
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

// Проверка, является ли устройство iOS в Telegram
const isIosTelegram = (telegram: TelegramWebApp | null): boolean => {
  if (!telegram) return false;
  // Проверяем platform из Telegram WebApp
  if (telegram.platform === 'ios' || telegram.platform === 'iphone' || telegram.platform === 'ipad') {
    return true;
  }
  // Fallback на user agent
  if (typeof navigator !== 'undefined') {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }
  return false;
};

// Глобальный флаг для предотвращения множественной инициализации
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;
// Глобально инициализированный telegram объект (для синхронизации между компонентами)
let globalTelegram: TelegramWebApp | null = null;
let globalIsMockMode = false;

// Проверка версии Telegram Web App для поддержки методов
const isVersionSupported = (version: string, minVersion: string): boolean => {
  const versionParts = version.split('.').map(Number);
  const minParts = minVersion.split('.').map(Number);
  
  for (let i = 0; i < Math.max(versionParts.length, minParts.length); i++) {
    const v = versionParts[i] || 0;
    const m = minParts[i] || 0;
    if (v > m) return true;
    if (v < m) return false;
  }
  return true;
};

export const useTelegram = () => {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>('');
  const [isBaseReady, setIsBaseReady] = useState(false);
  const [isViewportReady, setIsViewportReady] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  
  // Храним ссылки на telegram и viewportChangedHandler для cleanup
  const telegramRef = useRef<TelegramWebApp | null>(null);
  const viewportChangedHandlerRef = useRef<(() => void) | null>(null);
  
  // isReady = isBaseReady && isViewportReady
  const isReady = isBaseReady && isViewportReady;

  useEffect(() => {
    // Если инициализация уже завершена, синхронизируем состояние с глобальным объектом
    if (isInitialized && !initializationPromise && globalTelegram) {
      telegramRef.current = globalTelegram;
      setTg(globalTelegram);
      setUser(globalTelegram.initDataUnsafe?.user || null);
      setInitData(globalTelegram.initData || '');
      setIsMockMode(globalIsMockMode);
      setIsBaseReady(true);
      setIsViewportReady(true);
      return;
    }
    
    // Если инициализация уже идет, ждем её завершения
    if (initializationPromise) {
      initializationPromise.then(() => {
        // После завершения инициализации обновляем состояние из глобального объекта
        if (globalTelegram) {
          telegramRef.current = globalTelegram;
          setTg(globalTelegram);
          setUser(globalTelegram.initDataUnsafe?.user || null);
          setInitData(globalTelegram.initData || '');
          setIsMockMode(globalIsMockMode);
          setIsBaseReady(true);
          setIsViewportReady(true);
        }
      });
      return;
    }
    
    // Начинаем инициализацию
    isInitialized = true;
    initializationPromise = (async () => {
    const isDev = import.meta.env.DEV;
    const hasTelegramWebApp = Boolean(window.Telegram?.WebApp);
    // ✅ FIX: Проверяем, что initData не только существует, но и не пустая строка
    // При inline query initData может быть строкой с user и query_id (без chat)
    const rawInitData = window.Telegram?.WebApp?.initData;
    const hasInitData = Boolean(rawInitData && rawInitData.trim() !== '');
    
    let telegram: TelegramWebApp;
    let viewportChangedHandler: (() => void) | null = null;
    
    // Проверяем наличие реального initData в localStorage (для тестирования с ModHeader)
    const realInitDataForTesting = getRealInitDataForTesting();
    
    // В dev режиме без реальных данных Telegram - используем mock
    if (isDev && (!hasTelegramWebApp || !hasInitData)) {
      console.log('🔧 DEV MODE: Используется mock Telegram окружение');
      telegram = createMockTelegramEnv(realInitDataForTesting);
      globalIsMockMode = true;
      setIsMockMode(true);
    } else if (hasTelegramWebApp) {
      // Используем @twa-dev/SDK (production или real Telegram)
      telegram = WebApp as unknown as TelegramWebApp;
      globalIsMockMode = false;
    } else {
      // В production без Telegram WebApp - используем mock
      console.log('🔧 PRODUCTION MODE: Telegram WebApp недоступен, используем mock');
      telegram = createMockTelegramEnv(realInitDataForTesting);
      globalIsMockMode = true;
      setIsMockMode(true);
    }
    
    if (telegram) {
      // Сохраняем в глобальную переменную для синхронизации между компонентами
      globalTelegram = telegram;
      
      // Сохраняем ссылку для cleanup
      telegramRef.current = telegram;
      
      setTg(telegram);
      setUser(telegram.initDataUnsafe?.user || null);
      
      // ✅ FIX: Всегда берем initData из telegram.initData (строка), независимо от наличия chat в initDataUnsafe
      // При inline query initData содержит user и query_id, но не содержит chat - это нормально
      const initDataValue = telegram.initData || '';
      setInitData(initDataValue);
      
      // ✅ FIX: Логирование для диагностики inline query контекста
      if (import.meta.env.DEV && initDataValue) {
        const hasChat = Boolean(telegram.initDataUnsafe?.chat);
        const hasQueryId = initDataValue.includes('query_id=');
        const hasUser = Boolean(telegram.initDataUnsafe?.user);
        
        if (hasQueryId && !hasChat) {
          console.log('🔍 Inline query контекст обнаружен:', {
            hasUser,
            hasQueryId,
            hasChat: false,
            initDataLength: initDataValue.length,
            initDataPreview: initDataValue.substring(0, 100) + '...'
          });
        }
      }
      
      // Определяем, находимся ли мы в реальном Telegram Mini App (не в браузере/mock)
      // Проверяем до ready(), чтобы знать, нужно ли ждать viewportChanged
      const isRealTelegramApp = hasTelegramWebApp && hasInitData && !isMockMode;
      const isIos = isIosTelegram(telegram);
      
      // Инициализация Telegram Web App
      telegram.ready();
      setIsBaseReady(true);
      
      // Для не-iOS платформ или не в реальном Telegram App сразу считаем viewport готовым
      if (!isIos || !isRealTelegramApp) {
        setIsViewportReady(true);
        if (import.meta.env.DEV) {
          console.log('✅ Viewport готов (не iOS или не в реальном Telegram App)', {
            isIos,
            isRealTelegramApp,
            isMockMode,
            platform: telegram.platform
          });
        }
      } else {
        // Для iOS в реальном Telegram App подписываемся на viewportChanged
        let viewportHandled = false;
        viewportChangedHandler = () => {
          if (!viewportHandled) {
            viewportHandled = true;
            setIsViewportReady(true);
            if (import.meta.env.DEV) {
              console.log('✅ Viewport готов (первый viewportChanged получен)');
            }
          }
          // Убрано expand() - он вызывается только при инициализации в setupTelegramViewportSafe()
        };
        
        // Сохраняем ссылку для cleanup
        viewportChangedHandlerRef.current = viewportChangedHandler;
        
        if (typeof telegram.onEvent === 'function') {
          telegram.onEvent('viewportChanged', viewportChangedHandler);
          if (import.meta.env.DEV) {
            console.log('⏳ Ожидаем viewportChanged для iOS...');
          }
          
          // Fallback: если viewportChanged не пришел за 2 секунды, считаем готовым
          const fallbackTimeout = setTimeout(() => {
            if (!viewportHandled) {
              viewportHandled = true;
              setIsViewportReady(true);
              if (import.meta.env.DEV) {
                console.log('⏰ Viewport готов (fallback timeout, viewportChanged не получен)');
              }
            }
          }, 2000);
          
          // Сохраняем timeout для cleanup
          (viewportChangedHandler as any).__fallbackTimeout = fallbackTimeout;
        } else {
          // Если onEvent недоступен, считаем готовым сразу
          setIsViewportReady(true);
        }
      }
      
      // Безопасная настройка viewport (expand + fullscreen на мобильных)
      // Работает с официальным SDK (@telegram-apps/sdk) или fallback на @twa-dev/sdk
      // Важно: expand() вызывается внутри setupTelegramViewportSafe() с правильной задержкой
      // requestFullscreen() вызывается после успешного expand() на мобильных устройствах
      setupTelegramViewportSafe().catch((error) => {
        // Детальное логирование ошибок с контекстом
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        console.warn('[TMA] Ошибка при настройке viewport:', {
          message: errorMessage,
          stack: errorStack,
          context: 'setupTelegramViewportSafe',
          platform: telegram.platform,
          version: telegram.version,
          isMobile: typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        });
        
        // Ошибки fullscreen не должны прерывать инициализацию приложения
        // Приложение продолжит работать даже если fullscreen недоступен
      });
      
      // Отключаем вертикальные свайпы, которые сворачивают Mini App (Bot API 7.7+)
      // Проверяем версию: disableVerticalSwipes доступен с версии 7.7+
      const version = telegram.version || '6.0';
      const supportsDisableSwipes = isVersionSupported(version, '7.7');
      
      // Вызываем disableVerticalSwipes только если версия поддерживает (>= 7.7)
      if (supportsDisableSwipes) {
        const webApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
        if (webApp && typeof webApp.disableVerticalSwipes === 'function') {
          try {
            webApp.disableVerticalSwipes();
            if (import.meta.env.DEV) {
              console.log('✅ Вертикальные свайпы отключены - Mini App не будет сворачиваться');
            }
          } catch (e) {
            // Игнорируем ошибки если метод не поддерживается
            if (import.meta.env.DEV) {
              console.warn('⚠️ disableVerticalSwipes вызвал ошибку:', e);
            }
          }
        } else if (typeof (telegram as any).disableVerticalSwipes === 'function') {
          try {
            (telegram as any).disableVerticalSwipes();
            if (import.meta.env.DEV) {
              console.log('✅ Вертикальные свайпы отключены (через telegram объект)');
            }
          } catch (e) {
            // Игнорируем ошибки если метод не поддерживается
            if (import.meta.env.DEV) {
              console.warn('⚠️ disableVerticalSwipes вызвал ошибку:', e);
            }
          }
        }
      } else if (import.meta.env.DEV) {
        console.log(`ℹ️ disableVerticalSwipes пропущен - требуется версия >= 7.7, текущая: ${version}`);
      }
      
      // Убрано: expand() из scroll-логики и viewportChanged handlers
      // expand() вызывается только один раз при инициализации в setupTelegramViewportSafe()
      
      // Устанавливаем цвета header и фона (единый вид на всех устройствах)
      const supportsColorMethods = isVersionSupported(version, '7.0');
      if (supportsColorMethods) {
        const tgAny = telegram as { setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void };
        const bgColor = '#191818';
        if (typeof tgAny.setHeaderColor === 'function') {
          try {
            tgAny.setHeaderColor('bg_color');
          } catch (e) {
            if (import.meta.env.DEV) console.warn('⚠️ setHeaderColor:', e);
          }
        }
        if (typeof tgAny.setBackgroundColor === 'function') {
          try {
            tgAny.setBackgroundColor(bgColor);
          } catch (e) {
            if (import.meta.env.DEV) console.warn('⚠️ setBackgroundColor:', e);
          }
        }
      }

      // Логируем только в dev режиме
      if (import.meta.env.DEV) {
        console.log('🔍 Telegram Web App данные:');
        console.log('Mode:', isMockMode ? 'MOCK' : 'PRODUCTION');
        console.log('tg.initData:', telegram.initData ? `present (${telegram.initData.length} chars)` : 'null');
        console.log('tg.initDataUnsafe:', telegram.initDataUnsafe);
        console.log('user:', telegram.initDataUnsafe?.user);
        console.log('platform:', telegram.platform);
        console.log('version:', telegram.version);
        
        // ✅ FIX: Детальная отладка initData с определением контекста (inline query vs обычный)
        if (telegram.initData) {
          const params = new URLSearchParams(telegram.initData);
          const hasChat = Boolean(telegram.initDataUnsafe?.chat);
          const hasQueryId = telegram.initData.includes('query_id=');
          const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : hasChat ? 'CHAT' : 'UNKNOWN';
          
          console.log('🔍 Детальный разбор initData:');
          console.log('  Контекст:', context);
          console.log('  hasChat:', hasChat);
          console.log('  hasQueryId:', hasQueryId);
          for (const [key, value] of params.entries()) {
            console.log(`  ${key}:`, value);
          }
          
          // Предупреждение, если initData есть, но chat отсутствует (возможный inline query)
          if (!hasChat && !hasQueryId && telegram.initDataUnsafe?.user) {
            console.warn('⚠️ initData присутствует, но chat отсутствует. Возможно, это inline query контекст.');
          }
        }
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('⚠️ Telegram Web App не доступен');
      }
      setIsBaseReady(true);
      setIsViewportReady(true);
    }
    })(); // Закрываем async функцию инициализации
    
    // Cleanup функция
    return () => {
      // Отписываемся от viewportChanged
      const handler = viewportChangedHandlerRef.current;
      const telegram = telegramRef.current;
      if (handler && telegram && typeof telegram.offEvent === 'function') {
        telegram.offEvent('viewportChanged', handler);
      }
      
      // Очищаем fallback timeout
      if (handler && (handler as any).__fallbackTimeout) {
        clearTimeout((handler as any).__fallbackTimeout);
      }
      
      // Очищаем debounce timeout для updateHeaderColor
      if (updateHeaderColorTimeoutRef.current !== null) {
        clearTimeout(updateHeaderColorTimeoutRef.current);
        updateHeaderColorTimeoutRef.current = null;
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

  // Функция для обновления цвета header с проверкой версии и debounce
  const lastColorRef = useRef<string>('');
  const updateHeaderColorTimeoutRef = useRef<number | null>(null);
  const versionCheckedRef = useRef<boolean>(false);
  const supportsHeaderColorRef = useRef<boolean>(false);
  
  const updateHeaderColor = (color: string) => {
    // Проверяем версию перед вызовом метода
    if (!tg) return;
    
    // Кешируем результат проверки версии, чтобы не проверять каждый раз
    if (!versionCheckedRef.current) {
      const version = tg.version || '6.0';
      supportsHeaderColorRef.current = isVersionSupported(version, '7.0');
      versionCheckedRef.current = true;
      
      if (!supportsHeaderColorRef.current && import.meta.env.DEV) {
        console.log(`ℹ️ updateHeaderColor пропущен - требуется версия >= 7.0, текущая: ${version}`);
      }
    }
    
    // Версия не поддерживает setHeaderColor, игнорируем без вывода ошибок
    if (!supportsHeaderColorRef.current) {
      return;
    }
    
    // Предотвращаем множественные вызовы с одинаковым цветом
    if (lastColorRef.current === color) {
      return;
    }
    
    // Debounce: отменяем предыдущий вызов если он еще не выполнен
    if (updateHeaderColorTimeoutRef.current !== null) {
      clearTimeout(updateHeaderColorTimeoutRef.current);
    }
    
    // Задержка для группировки множественных вызовов
    updateHeaderColorTimeoutRef.current = window.setTimeout(() => {
      const tgAny = tg as { setHeaderColor?: (c: string) => void } | null;
      if (tgAny && typeof tgAny.setHeaderColor === 'function') {
        try {
          // Используем 'bg_color' как ключ, а не hex цвет
          // setHeaderColor принимает ключ цвета ('bg_color', 'secondary_bg_color'), а не hex
          tgAny.setHeaderColor('bg_color');
          lastColorRef.current = color;
        } catch (e) {
          // Игнорируем ошибки если метод не поддерживается
          // Не логируем в production, чтобы не засорять консоль
          if (import.meta.env.DEV) {
            console.warn('⚠️ Ошибка при установке цвета header:', e);
          }
        }
      }
      updateHeaderColorTimeoutRef.current = null;
    }, 150); // 150ms debounce для уменьшения частоты вызовов
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
