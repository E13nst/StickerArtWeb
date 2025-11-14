// Platform detection utilities

/**
 * Detects if the current platform is iOS (iPhone, iPad, iPod)
 * Also detects iPad on iOS 13+ which identifies as MacIntel
 */
export const isIOS = 
  /iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Detects if the current platform is Android
 */
export const isAndroid = /Android/.test(navigator.userAgent);

/**
 * Detects if running in Telegram WebApp
 */
export const isTelegram = typeof window !== 'undefined' && 
  typeof (window as any).Telegram !== 'undefined' && 
  typeof (window as any).Telegram.WebApp !== 'undefined';

/**
 * Gets the platform name (iOS, Android, Web, etc.)
 */
export const getPlatform = (): string => {
  if (isIOS) return 'iOS';
  if (isAndroid) return 'Android';
  if (isTelegram) {
    const tg = (window as any).Telegram?.WebApp;
    return tg?.platform || 'Telegram';
  }
  return 'Web';
};

