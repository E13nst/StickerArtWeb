import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTelegram } from '../hooks/useTelegram';

interface AddStickerPackButtonProps {
  onClick: () => void;
  variant?: 'gallery' | 'profile';
}

export const AddStickerPackButton: React.FC<AddStickerPackButtonProps> = ({ onClick, variant = 'gallery' }) => {
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
  const glassHover = isLightTheme
    ? 'color-mix(in srgb, rgba(148, 198, 255, 0.38) 58%, transparent)'
    : 'color-mix(in srgb, rgba(98, 150, 255, 0.44) 74%, transparent)';
  const borderColor = isLightTheme ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';

  const buttonStyles: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    height: '2.2rem',
    padding: '0 0.75rem',
    borderRadius: '0.75rem',
    border: `1px solid ${borderColor}`,
    backgroundColor: glassSolid,
    background: glassBase,
    color: isLightTheme ? '#0D1B2A' : textColor,
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 6px 18px rgba(30, 72, 185, 0.14)',
    backdropFilter: 'blur(18px) saturate(180%)',
    WebkitBackdropFilter: 'blur(18px) saturate(180%)',
    boxSizing: 'border-box'
  }; 

  const textColorResolved = isLightTheme ? '#0D1B2A' : textColor;
  const hover = { opacity: '1', transform: 'scale(0.98)', background: glassHover, color: textColorResolved };
  const reset = { opacity: '1', transform: 'scale(1)', background: glassBase, color: textColorResolved };

  if (variant === 'gallery') {
    return (
      <button onClick={handleClick} style={buttonStyles} onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)} onMouseLeave={(e) => Object.assign(e.currentTarget.style, reset)}>
        <span style={{ fontSize: '0.875rem', lineHeight: '1', display: 'flex', alignItems: 'center', fontWeight: 400, color: textColorResolved }}>+</span>
        <span style={{ color: textColorResolved }}>Добавить</span>
        <span style={{ fontSize: '0.6875rem', opacity: isLightTheme ? 0.82 : 0.88, backgroundColor: glassSolid, padding: '2px 5px', borderRadius: '5px', color: textColorResolved, border: `1px solid ${borderColor}` }}>+10 ART</span>
      </button>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '2.5rem', px: '0.618rem', mb: 2 }}>
      <Button fullWidth variant="contained" onClick={handleClick} startIcon={<AddIcon />}
        sx={{ height: '2.5rem', px: '0.618rem', borderRadius: '0.59rem', color: `${textColorResolved} !important`, fontSize: '0.875rem', fontWeight: 600, textTransform: 'none', gap: '0.5rem', backgroundColor: glassSolid, background: glassBase, border: `1px solid ${borderColor}`, boxShadow: '0 6px 18px rgba(30, 72, 185, 0.14)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)', '& .MuiButton-startIcon': { margin: 0, '& svg': { fontSize: '0.955rem', color: 'inherit' } }, '&:hover': { background: glassHover, backgroundColor: glassHover, opacity: 1, transform: 'scale(0.98)', boxShadow: '0 10px 26px rgba(30, 72, 185, 0.18)', color: `${textColorResolved} !important` }, transition: 'all 0.2s ease', '& *': { color: `${textColorResolved} !important` } }}>
        Добавьте стикерпак
        <Chip label="+10 ART" size="small" sx={{ ml: 1, height: 'auto', fontSize: '0.75rem', backgroundColor: isLightTheme ? 'rgba(186, 218, 255, 0.32)' : 'rgba(135, 182, 255, 0.24)', color: textColor, fontWeight: 600, py: 0.25, '& .MuiChip-label': { color: `${textColor} !important` } }} />
      </Button>
    </Box>
  );
};

