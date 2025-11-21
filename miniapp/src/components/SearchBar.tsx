import React from 'react';
import { 
  TextField, 
  InputAdornment, 
  Box 
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useTelegram } from '../hooks/useTelegram';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

const SearchBarComponent: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Поиск стикеров...",
  disabled = false,
  compact = false
}) => {
  const { tg } = useTelegram();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;

  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const textColor = isLight ? 'rgba(13,27,42,0.64)' : 'var(--tg-theme-hint-color, rgba(255,255,255,0.64))';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.48)' : 'rgba(78, 132, 255, 0.24)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.32)' : 'rgba(88, 138, 255, 0.24)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.42)' : 'rgba(98, 150, 255, 0.38)';
  const accentShadow = isLight ? '0 6px 18px rgba(30, 72, 185, 0.14)' : '0 6px 18px rgba(28, 48, 108, 0.28)';
  const accentShadowHover = isLight ? '0 10px 26px rgba(30, 72, 185, 0.18)' : '0 10px 26px rgba(28, 48, 108, 0.34)';

  const handleClear = () => {
    onChange('');
    onSearch?.('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  const handleSearchClick = () => {
    if (onSearch && !disabled) {
      onSearch(value);
    }
  };

  return (
    <TextField
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyPress={handleKeyPress}
      disabled={disabled}
      inputProps={{ 'data-testid': 'search-input' }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Box
              component="button"
              onClick={handleSearchClick}
              sx={{
                border: 'none',
                background: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                color: disabled ? 'var(--tg-theme-hint-color)' : textColorResolved,
                opacity: disabled ? 0.5 : 1
              }}
              aria-label="Поиск"
              disabled={disabled}
            >
              <SearchIcon 
                sx={{ 
                  color: disabled ? 'var(--tg-theme-hint-color)' : textColorResolved,
                  opacity: disabled ? 0.5 : 1,
                  fontSize: '0.955rem' // 0.382 * 2.5rem ≈ 0.955rem
                }} 
              />
            </Box>
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <Box
              component="button"
              onClick={handleClear}
              sx={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                color: textColorResolved
              }}
              aria-label="Очистить поиск"
            >
              <ClearIcon sx={{ color: textColorResolved, fontSize: '0.955rem', opacity: 0.72 }} />
            </Box>
          </InputAdornment>
        ) : null,
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: '0.75rem',
          background: glassBase,
          backgroundColor: glassSolid,
          color: textColorResolved,
          height: compact ? '2.2rem' : '2.5rem',
          fontSize: compact ? '0.8125rem' : '0.875rem',
          paddingLeft: '0.618rem',
          paddingRight: '0.618rem',
          border: `1px solid ${borderColor}`,
          boxShadow: accentShadow,
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          transition: 'all 0.2s ease',
          '&:hover': {
            background: glassHover,
            backgroundColor: glassHover,
            transform: 'scale(0.99)',
            boxShadow: accentShadowHover,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor,
              borderWidth: 1,
            },
          },
          '&.Mui-focused': {
            background: glassHover,
            backgroundColor: glassHover,
            boxShadow: accentShadowHover,
            transform: 'scale(0.99)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor,
              borderWidth: 1,
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor,
            borderWidth: 1,
          },
        },
        '& .MuiInputBase-input': {
          color: textColorResolved,
          fontSize: '0.875rem',
          '&::placeholder': {
            color: textColor,
            opacity: 0.64,
          },
        },
      }}
    />
  );
};

// Мемоизация для предотвращения ререндера при изменении других пропсов родителя
export const SearchBar = React.memo(SearchBarComponent);
