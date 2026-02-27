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

// Базовая конфигурация mock Telegram окружения
const createMockTelegramEnvBase = (_mockUser: TelegramUser): Partial<TelegramWebApp> => {

  // Определяем тему на основе системных настроек
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const colorScheme = isDarkMode ? 'dark' : 'light';

  return {
    version: '7.0',
    platform: 'web',
    colorScheme: colorScheme,
    themeParams: isDarkMode ? {
      bg_color: '#191818',
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
      button_color: '#ee449f',
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
  
  // Слушатель изменений системной темы
  const systemThemeListenerRef = useRef<((e: MediaQueryListEvent) => void) | null>(null);
  
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
      
      // Устанавливаем цвета header и bottom bar в соответствии с темой
      // Проверяем версию: setHeaderColor и setBackgroundColor доступны с версии 7.0+
      const supportsColorMethods = isVersionSupported(version, '7.0');
      
      // Вызываем методы цвета только если версия поддерживает (>= 7.0)
      if (supportsColorMethods) {
        const tgAny = telegram as { setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void };
        if (typeof tgAny.setHeaderColor === 'function') {
          try {
            tgAny.setHeaderColor(telegram.colorScheme === 'dark' ? 'bg_color' : 'bg_color');
          } catch (e) {
            // Игнорируем ошибки если метод не поддерживается
            if (import.meta.env.DEV) {
              console.warn('⚠️ setHeaderColor вызвал ошибку:', e);
            }
          }
        }
        
        if (typeof tgAny.setBackgroundColor === 'function') {
          try {
            tgAny.setBackgroundColor(telegram.themeParams?.bg_color || '#ffffff');
          } catch (e) {
            // Игнорируем ошибки если метод не поддерживается
            if (import.meta.env.DEV) {
              console.warn('⚠️ setBackgroundColor вызвал ошибку:', e);
            }
          }
        }
      } else if (import.meta.env.DEV) {
        console.log(`ℹ️ Методы цвета пропущены - требуется версия >= 7.0, текущая: ${version}`);
      }
      
      // Функция для конвертации hex в RGB (используется в applyTheme и при загрузке сохраненной темы)
      const hexToRgb = (hex: string): string => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
      };

      // Нормализуем устаревший bg_color #18222d -> #191818
      const normalizedBgColor = (c: string | undefined, darkFallback: string) =>
        !c ? darkFallback : (c === '#18222d' || c.toLowerCase() === '#18222d' ? '#191818' : c);

      // Функция применения темы
      const applyTheme = () => {
        if (telegram.themeParams) {
          const root = document.documentElement;
          const body = document.body;
          const isDark = true; /* Единая тёмная тема */
          const bgColor = normalizedBgColor(
            telegram.themeParams.bg_color,
            isDark ? '#191818' : '#ffffff'
          );

          // CSS переменные для темы
          root.style.setProperty('--tg-theme-bg-color', bgColor);
          root.style.setProperty('--tg-theme-text-color', telegram.themeParams.text_color || '#000000');
          root.style.setProperty('--tg-theme-hint-color', telegram.themeParams.hint_color || '#999999');
          root.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color || '#ee449f');
          root.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color || '#ffffff');
          root.style.setProperty('--tg-theme-secondary-bg-color', telegram.themeParams.secondary_bg_color || '#f8f9fa');
          root.style.setProperty('--tg-theme-link-color', telegram.themeParams.link_color || '#2481cc');
          
          // Дополнительные переменные для лучшей поддержки тем
          root.style.setProperty('--tg-theme-border-color', isDark ? '#2a3441' : '#e0e0e0');
          root.style.setProperty('--tg-theme-shadow-color', isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)');
          root.style.setProperty('--tg-theme-overlay-color', isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)');
          
          // RGB-переменные для rgba() использования
          const textColor = telegram.themeParams.text_color || (isDark ? '#ffffff' : '#000000');
          const buttonColor = telegram.themeParams.button_color || '#ee449f';
          
          root.style.setProperty('--tg-theme-bg-color-rgb', hexToRgb(bgColor));
          root.style.setProperty('--tg-theme-text-color-rgb', hexToRgb(textColor));
          root.style.setProperty('--tg-theme-button-color-rgb', hexToRgb(buttonColor));
          root.style.setProperty('--tg-theme-error-color-rgb', '244, 67, 54'); // Фиксированный цвет ошибки
          
          // Применяем тему к body
          body.style.backgroundColor = bgColor;
          body.style.color = telegram.themeParams.text_color || '#000000';
          if (import.meta.env.DEV) {
            console.log('[theme] body backgroundColor/color set — useTelegram.applyTheme', { bgColor });
          }
          // Устанавливаем класс для темной темы
          if (isDark) {
            root.classList.add('tg-dark-theme');
            root.classList.remove('tg-light-theme');
          } else {
            root.classList.add('tg-light-theme');
            root.classList.remove('tg-dark-theme');
          }
          
          // Сохраняем тему в localStorage (с нормализованным bg_color)
          try {
            const paramsToSave = { ...telegram.themeParams, bg_color: bgColor };
            localStorage.setItem('stixly_tg_theme', JSON.stringify({
              scheme: telegram.colorScheme,
              params: paramsToSave
            }));
          } catch (error) {
            console.warn('Не удалось сохранить тему в localStorage:', error);
          }
          
          // Обновляем цвета header и bottom bar при изменении темы
          // Проверяем версию перед вызовом методов (только >= 7.0)
          const currentVersion = telegram.version || '6.0';
          const supportsColorMethods = isVersionSupported(currentVersion, '7.0');
          
          // Вызываем методы только если версия поддерживает
          if (supportsColorMethods) {
            const tgAny = telegram as { setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void };
            if (typeof tgAny.setHeaderColor === 'function') {
              try {
                tgAny.setHeaderColor(telegram.colorScheme === 'dark' ? 'bg_color' : 'bg_color');
              } catch (e) {
                // Игнорируем ошибки если метод не поддерживается
                if (import.meta.env.DEV) {
                  console.warn('⚠️ setHeaderColor в applyTheme вызвал ошибку:', e);
                }
              }
            }
            
            if (typeof tgAny.setBackgroundColor === 'function') {
              try {
                tgAny.setBackgroundColor(bgColor);
              } catch (e) {
                // Игнорируем ошибки если метод не поддерживается
                if (import.meta.env.DEV) {
                  console.warn('⚠️ setBackgroundColor в applyTheme вызвал ошибку:', e);
                }
              }
            }
          }
          // Если версия < 7.0, просто не вызываем методы - это нормально
          
          if (import.meta.env.DEV) {
            console.log('🎨 Тема применена:', telegram.colorScheme);
          }
        }
      };
      
      // Миграция: заменяем устаревший #18222d на базовый #191818
      const migrateBgColor = (p: { bg_color?: string } | null | undefined) => {
        if (!p?.bg_color) return p;
        if (p.bg_color === '#18222d' || p.bg_color.toLowerCase() === '#18222d') {
          return { ...p, bg_color: '#191818' };
        }
        return p;
      };

      // Применяем тему: сначала проверяем локально сохранённую
      const savedTheme = (() => {
        try {
          const raw = localStorage.getItem('stixly_tg_theme');
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed?.params) {
            parsed.params = migrateBgColor(parsed.params);
          }
          return parsed;
        } catch {
          return null;
        }
      })();

      if (savedTheme?.scheme === 'dark') {
        const root = document.documentElement;
        const body = document.body;
        const params = savedTheme.params || {
          bg_color: '#191818',
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
        root.style.setProperty('--tg-theme-border-color', '#2a3441');
        root.style.setProperty('--tg-theme-shadow-color', 'rgba(0, 0, 0, 0.3)');
        root.style.setProperty('--tg-theme-overlay-color', 'rgba(0, 0, 0, 0.8)');
        root.style.setProperty('--tg-theme-bg-color-rgb', hexToRgb(params.bg_color));
        root.style.setProperty('--tg-theme-text-color-rgb', hexToRgb(params.text_color));
        root.style.setProperty('--tg-theme-button-color-rgb', hexToRgb(params.button_color));
        root.style.setProperty('--tg-theme-error-color-rgb', '244, 67, 54');
        body.style.backgroundColor = params.bg_color;
        body.style.color = params.text_color;
        if (import.meta.env.DEV) {
          console.log('[theme] body backgroundColor/color set — useTelegram.savedThemeDark', { bg: params.bg_color });
        }
        root.classList.add('tg-dark-theme');
        root.classList.remove('tg-light-theme');
      } else if (savedTheme?.scheme === 'light') {
        /* Всегда применяем тёмную тему */
        applyTheme();
      } else {
        applyTheme();
      }
      
      // Подписываемся на изменения темы
      if (typeof telegram.onEvent === 'function') {
        telegram.onEvent('themeChanged', () => {
          const justClosed = (window as Window & { __stixlyModalJustClosed?: number }).__stixlyModalJustClosed;
          const guardMs = 450;
          if (justClosed != null && Date.now() - justClosed < guardMs) {
            if (import.meta.env.DEV) {
              console.log('🎨 themeChanged отложен (модалка только что закрылась)');
            }
            return;
          }
          if (import.meta.env.DEV) {
            console.log('🎨 Тема изменилась на:', telegram.colorScheme);
          }
          applyTheme();
        });
      }
      
      // Слушаем изменения системной темы
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemThemeListenerRef.current = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem('stixly_tg_theme')) {
          // Применяем системную тему только если пользователь не выбрал принудительную
          if (import.meta.env.DEV) {
            console.log('🎨 Системная тема изменилась на:', e.matches ? 'dark' : 'light');
          }
          applyTheme();
        }
      };
      
      mediaQuery.addEventListener('change', systemThemeListenerRef.current);
      
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
      if (systemThemeListenerRef.current) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.removeEventListener('change', systemThemeListenerRef.current);
      }
      
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
