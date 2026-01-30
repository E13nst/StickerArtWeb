import React, { useCallback, useEffect, useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import './AddStickerPackButton.css';

interface AddStickerPackButtonProps {
  onClick: () => void;
  variant?: 'gallery' | 'profile';
}

const AddStickerPackButtonComponent: React.FC<AddStickerPackButtonProps> = ({ onClick, variant = 'gallery' }) => {
  const { tg } = useTelegram();
  const handleClick = () => { tg?.HapticFeedback?.impactOccurred('light'); onClick(); };

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

    const observer = typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
      ? new MutationObserver(handleThemeChange)
      : null;

    if (observer) {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    }

    let mediaQuery: MediaQueryList | undefined;
    const handleMediaQueryChange = (event: MediaQueryListEvent) => setIsLightTheme(event.matches);

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

  const textColor = isLightTheme ? '#0D3B9D' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLightTheme
    ? 'rgba(164, 206, 255, 0.32)'
    : 'color-mix(in srgb, rgba(88, 138, 255, 0.36) 60%, transparent)';
  const glassSolid = isLightTheme ? 'rgba(164, 206, 255, 0.48)' : 'rgba(78, 132, 255, 0.24)';
  const borderColor = isLightTheme ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';

  const textColorResolved = isLightTheme ? '#0D1B2A' : textColor;

  if (variant === 'gallery') {
    return (
      <button 
        onClick={handleClick} 
        className="add-sticker-pack-button add-sticker-pack-button--gallery"
        style={{
          backgroundColor: glassSolid,
          background: glassBase,
          borderColor: borderColor,
          color: textColorResolved,
        }}
      >
        <span className="add-sticker-pack-button__plus">+</span>
        <span>Добавить</span>
        <span 
          className="add-sticker-pack-button__badge"
          style={{
            backgroundColor: glassSolid,
            borderColor: borderColor,
          }}
        >
          +10 ART
        </span>
      </button>
    );
  }

  return (
    <div className="add-sticker-pack-button-wrapper">
      <button 
        onClick={handleClick} 
        className="add-sticker-pack-button add-sticker-pack-button--profile"
        style={{
          backgroundColor: glassSolid,
          background: glassBase,
          borderColor: borderColor,
          color: textColorResolved,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Добавьте стикерпак</span>
        <span 
          className="add-sticker-pack-button__badge"
          style={{
            backgroundColor: isLightTheme ? 'rgba(186, 218, 255, 0.32)' : 'rgba(135, 182, 255, 0.24)',
          }}
        >
          +10 ART
        </span>
      </button>
    </div>
  );
};

export const AddStickerPackButton = React.memo(AddStickerPackButtonComponent);
