import React from 'react';
import { Box, Button, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTelegram } from '@/hooks/useTelegram';

interface AddStickerPackButtonProps {
  onClick: () => void;
  variant?: 'gallery' | 'profile';
}

const buttonStyles = {
  width: '100%',
  maxWidth: '100%',
  height: '2.2rem',
  padding: '0 0.75rem',
  borderRadius: '0.75rem',
  border: 'none',
  backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
  color: 'var(--tg-theme-button-text-color, #ffffff)',
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  transition: 'all 0.2s ease',
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
  boxSizing: 'border-box'
};

export const AddStickerPackButton: React.FC<AddStickerPackButtonProps> = ({ onClick, variant = 'gallery' }) => {
  const { tg } = useTelegram();
  const handleClick = () => { tg?.HapticFeedback?.impactOccurred('light'); onClick(); };
  const hover = { opacity: '0.9', transform: 'scale(0.98)' };
  const reset = { opacity: '1', transform: 'scale(1)' };

  if (variant === 'gallery') {
    return (
      <button onClick={handleClick} style={buttonStyles} onMouseEnter={(e) => Object.assign(e.currentTarget.style, hover)} onMouseLeave={(e) => Object.assign(e.currentTarget.style, reset)}>
        <span style={{ fontSize: '0.875rem', lineHeight: '1', display: 'flex', alignItems: 'center', fontWeight: 400 }}>+</span>
        <span>Добавить</span>
        <span style={{ fontSize: '0.6875rem', opacity: 0.85, backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '2px 5px', borderRadius: '5px' }}>+10 ART</span>
      </button>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: '2.5rem', px: '0.618rem', mb: 2 }}>
      <Button fullWidth variant="contained" onClick={handleClick} startIcon={<AddIcon />}
        sx={{ height: '2.5rem', px: '0.618rem', borderRadius: '0.59rem', backgroundColor: 'var(--tg-theme-button-color, #2481cc)', color: 'var(--tg-theme-button-text-color, #ffffff)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'none', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', gap: '0.5rem', '& .MuiButton-startIcon': { margin: 0, '& svg': { fontSize: '0.955rem' } }, '&:hover': { backgroundColor: 'var(--tg-theme-button-color, #2481cc)', opacity: 0.9, transform: 'scale(0.98)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)' }, transition: 'all 0.2s ease' }}>
        Добавьте стикерпак
        <Chip label="+10 ART" size="small" sx={{ ml: 1, height: 'auto', fontSize: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--tg-theme-button-text-color, #ffffff)', fontWeight: 600, py: 0.25 }} />
      </Button>
    </Box>
  );
};

