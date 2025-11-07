import React from 'react';
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
  const detectedScheme = tg?.colorScheme
    ?? (document.documentElement.classList.contains('tg-light-theme')
      ? 'light'
      : document.documentElement.classList.contains('tg-dark-theme')
        ? 'dark'
        : undefined);
  const fallbackPrefersLight = typeof window !== 'undefined'
    && 'matchMedia' in window
    && window.matchMedia('(prefers-color-scheme: light)').matches;
  const isLightTheme = detectedScheme ? detectedScheme === 'light' : fallbackPrefersLight;

  const textColor = isLightTheme ? '#0D3B9D' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLightTheme
    ? 'color-mix(in srgb, rgba(134, 186, 255, 0.42) 44%, transparent)'
    : 'color-mix(in srgb, rgba(88, 138, 255, 0.36) 60%, transparent)';
  const glassSolid = isLightTheme ? 'rgba(164, 206, 255, 0.26)' : 'rgba(78, 132, 255, 0.16)';
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
    color: textColor,
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

  const hover = { opacity: '1', transform: 'scale(0.98)', background: glassHover, color: textColor };
  const reset = { opacity: '1', transform: 'scale(1)', background: glassBase, color: textColor };

  if (variant === 'gallery') {
    return (
      <button onClick={handleClick} style={buttonStyles} onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)} onMouseLeave={(e) => Object.assign(e.currentTarget.style, reset)}>
        <span style={{ fontSize: '0.875rem', lineHeight: '1', display: 'flex', alignItems: 'center', fontWeight: 400, color: textColor }}>+</span>
        <span style={{ color: textColor }}>Добавить</span>
        <span style={{ fontSize: '0.6875rem', opacity: isLightTheme ? 0.82 : 0.88, backgroundColor: isLightTheme ? 'rgba(186, 218, 255, 0.32)' : 'rgba(135, 182, 255, 0.24)', padding: '2px 5px', borderRadius: '5px', color: textColor }}>+10 ART</span>
      </button>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '2.5rem', px: '0.618rem', mb: 2 }}>
      <Button fullWidth variant="contained" onClick={handleClick} startIcon={<AddIcon />}
        sx={{ height: '2.5rem', px: '0.618rem', borderRadius: '0.59rem', color: `${textColor} !important`, fontSize: '0.875rem', fontWeight: 600, textTransform: 'none', gap: '0.5rem', backgroundColor: glassSolid, background: glassBase, border: `1px solid ${borderColor}`, boxShadow: '0 6px 18px rgba(30, 72, 185, 0.14)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)', '& .MuiButton-startIcon': { margin: 0, '& svg': { fontSize: '0.955rem', color: 'inherit' } }, '&:hover': { background: glassHover, backgroundColor: glassHover, opacity: 1, transform: 'scale(0.98)', boxShadow: '0 10px 26px rgba(30, 72, 185, 0.18)', color: `${textColor} !important` }, transition: 'all 0.2s ease', '& *': { color: `${textColor} !important` } }}>
        Добавьте стикерпак
        <Chip label="+10 ART" size="small" sx={{ ml: 1, height: 'auto', fontSize: '0.75rem', backgroundColor: isLightTheme ? 'rgba(186, 218, 255, 0.32)' : 'rgba(135, 182, 255, 0.24)', color: textColor, fontWeight: 600, py: 0.25, '& .MuiChip-label': { color: `${textColor} !important` } }} />
      </Button>
    </Box>
  );
};

