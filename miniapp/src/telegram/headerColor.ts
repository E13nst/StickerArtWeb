/**
 * Applies Telegram WebApp header color and expands the app
 * This syncs the Telegram chrome with our app's header background
 */
export function applyTelegramHeaderColor(color: string = '#0E0F1A'): void {
  try {
    if (typeof window === 'undefined') return;
    
    const telegram = (window as any).Telegram?.WebApp;
    if (!telegram) {
      console.warn('[Stixly] Telegram WebApp not available');
      return;
    }

    // Set header color to match our app background
    if (typeof telegram.setHeaderColor === 'function') {
      telegram.setHeaderColor(color);
      console.log(`[Stixly] Telegram header color set to: ${color}`);
    }

    // Expand to fullscreen (removes unexpected top gaps)
    if (typeof telegram.expand === 'function') {
      telegram.expand();
    }
  } catch (e) {
    console.warn('[Stixly] Failed to apply Telegram header color:', e);
  }
}

/**
 * Initializes Telegram WebApp header color after ready event
 */
export function initTelegramHeaderColor(color: string = '#0E0F1A'): void {
  try {
    if (typeof window === 'undefined') return;
    
    const telegram = (window as any).Telegram?.WebApp;
    if (!telegram) {
      console.warn('[Stixly] Telegram WebApp not available');
      return;
    }

    // Apply immediately if already ready
    if (telegram.isReady) {
      applyTelegramHeaderColor(color);
    } else {
      // Wait for ready event
      if (typeof telegram.ready === 'function') {
        telegram.ready();
      }
      
      // Apply after a short delay to ensure Telegram is initialized
      setTimeout(() => {
        applyTelegramHeaderColor(color);
      }, 100);
    }
  } catch (e) {
    console.warn('[Stixly] Failed to initialize Telegram header color:', e);
  }
}

