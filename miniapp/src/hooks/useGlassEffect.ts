import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTelegram } from './useTelegram';

export interface GlassEffectTokens {
  isLightTheme: boolean;
  textColor: string;
  textColorResolved: string;
  glassBase: string;
  glassSolid: string;
  glassHover: string;
  borderColor: string;
  accentShadow: string;
  accentShadowHover: string;
}

export const useGlassEffect = (): GlassEffectTokens => {
  const { tg } = useTelegram();

  const computeIsLightTheme = useCallback(() => {
    if (tg?.colorScheme === 'light') return true;
    if (tg?.colorScheme === 'dark') return false;

    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('tg-light-theme')) return true;
      if (document.documentElement.classList.contains('tg-dark-theme')) return false;

      const themeAttr = document.documentElement.getAttribute('data-theme');
      if (themeAttr === 'light') return true;
      if (themeAttr === 'dark') return false;
    }

    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }

    return true;
  }, [tg]);

  const [isLightTheme, setIsLightTheme] = useState<boolean>(computeIsLightTheme);

  useEffect(() => {
    setIsLightTheme(computeIsLightTheme());

    const handleThemeChange = () => setIsLightTheme(computeIsLightTheme());
    tg?.onEvent?.('themeChanged', handleThemeChange);

    const observer =
      typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
        ? new MutationObserver(handleThemeChange)
        : null;

    if (observer) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
    }

    let mediaQuery: MediaQueryList | undefined;
    const handleMediaQueryChange = (event: MediaQueryListEvent) =>
      setIsLightTheme(event.matches);

    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      mediaQuery.addEventListener('change', handleMediaQueryChange);
    }

    return () => {
      tg?.offEvent?.('themeChanged', handleThemeChange);
      observer?.disconnect();
      mediaQuery?.removeEventListener('change', handleMediaQueryChange);
    };
  }, [tg, computeIsLightTheme]);

  return useMemo(() => {
    const textColor = isLightTheme ? '#0D3B9D' : 'var(--tg-theme-button-text-color, #ffffff)';
    const textColorResolved = isLightTheme ? '#0D1B2A' : textColor;
    const glassBase = isLightTheme
      ? 'rgba(164, 206, 255, 0.32)'
      : 'color-mix(in srgb, rgba(88, 138, 255, 0.36) 60%, transparent)';
    const glassSolid = isLightTheme ? 'rgba(164, 206, 255, 0.48)' : 'rgba(78, 132, 255, 0.24)';
    const glassHover = isLightTheme
      ? 'color-mix(in srgb, rgba(148, 198, 255, 0.38) 58%, transparent)'
      : 'color-mix(in srgb, rgba(98, 150, 255, 0.44) 74%, transparent)';
    const borderColor = isLightTheme ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';

    return {
      isLightTheme,
      textColor,
      textColorResolved,
      glassBase,
      glassSolid,
      glassHover,
      borderColor,
      accentShadow: '0 6px 18px rgba(30, 72, 185, 0.14)',
      accentShadowHover: '0 10px 26px rgba(30, 72, 185, 0.18)',
    };
  }, [isLightTheme]);
};


