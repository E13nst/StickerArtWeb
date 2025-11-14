/**
 * Extracts actual background color from rendered header and converts to hex
 */
function extractHeaderBackgroundColor(): string {
  try {
    const header = document.getElementById('stixlytopheader');
    if (!header) return '#0E0F1A';
    
    // Try to get background from inner div
    const innerDiv = header.querySelector('.stixly-top-header') as HTMLElement;
    if (innerDiv) {
      const bgColor = window.getComputedStyle(innerDiv).backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        // Convert rgb() to hex
        const match = bgColor.match(/\d+/g);
        if (match && match.length >= 3) {
          const r = parseInt(match[0]);
          const g = parseInt(match[1]);
          const b = parseInt(match[2]);
          const hex = `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
          console.log('[Stixly] Extracted header background color:', hex);
          return hex;
        }
      }
    }
  } catch (e) {
    console.warn('[Stixly] Failed to extract header color:', e);
  }
  
  // Fallback to base color
  return '#0E0F1A';
}

/**
 * Applies Telegram WebApp header color and expands the app
 * This syncs the Telegram chrome with our app's header background
 */
export function applyTelegramHeaderColor(color: string | null = null): void {
  try {
    if (typeof window === 'undefined') return;
    
    const telegram = (window as any).Telegram?.WebApp;
    if (!telegram) {
      console.warn('[Stixly] Telegram WebApp not available');
      return;
    }

    // If color not provided, extract from actual header background
    const finalColor = color || extractHeaderBackgroundColor();

    // Set header color to match our app background
    if (typeof telegram.setHeaderColor === 'function') {
      telegram.setHeaderColor(finalColor);
      console.log(`[Stixly] Telegram header color set to: ${finalColor}`);
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
 * Syncs Telegram header color with actual rendered header background
 * Call this after header is rendered to match the current slide/gradient
 */
export function syncTelegramHeaderWithBackground(): void {
  applyTelegramHeaderColor(null); // null triggers color extraction
}

/**
 * Initializes Telegram WebApp header color after ready event
 */
export function initTelegramHeaderColor(color: string | null = null): void {
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
      
      // Also sync after header is fully rendered (allow React hydration)
      setTimeout(() => {
        syncTelegramHeaderWithBackground();
      }, 500);
    }
  } catch (e) {
    console.warn('[Stixly] Failed to initialize Telegram header color:', e);
  }
}

