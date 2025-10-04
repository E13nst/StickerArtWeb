import { useEffect } from 'react';

declare global { 
  interface Window { 
    Telegram?: {
      WebApp?: {
        viewportStableHeight?: number;
        onEvent?: (event: string, callback: () => void) => void;
        offEvent?: (event: string, callback: () => void) => void;
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
      };
    };
  } 
}

export function useTgSafeArea() {
  useEffect(() => {
    const root = document.documentElement;
    const tg = window.Telegram?.WebApp;
    
    const setVars = () => {
      const header = Math.max(0, (window.innerHeight || 0) - (tg?.viewportStableHeight || 0));
      root.style.setProperty('--tg-topbar', `${Math.min(header, 56)}px`);
    };

    const updateTheme = () => {
      if (tg?.themeParams) {
        const theme = tg.themeParams;
        root.style.setProperty('--tg-bg-color', theme.bg_color || '#ffffff');
        root.style.setProperty('--tg-text-color', theme.text_color || '#000000');
        root.style.setProperty('--tg-hint-color', theme.hint_color || '#999999');
        root.style.setProperty('--tg-link-color', theme.link_color || '#2481cc');
        root.style.setProperty('--tg-button-color', theme.button_color || '#2481cc');
        root.style.setProperty('--tg-button-text-color', theme.button_text_color || '#ffffff');
      }
    };

    setVars();
    updateTheme();
    
    tg?.onEvent?.('viewportChanged', setVars);
    tg?.onEvent?.('themeChanged', updateTheme);
    
    return () => {
      tg?.offEvent?.('viewportChanged', setVars);
      tg?.offEvent?.('themeChanged', updateTheme);
    };
  }, []);
}
