import React from 'react';
import { 
  TextField, 
  InputAdornment, 
  Box 
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Поиск стикеров...",
  disabled = false
}) => {
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
    if (onSearch) {
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
                color: 'var(--tg-theme-hint-color)',
                opacity: disabled ? 0.5 : 1
              }}
              aria-label="Поиск"
              disabled={disabled}
            >
              <SearchIcon 
                sx={{ 
                  color: disabled ? 'var(--tg-theme-hint-color)' : 'var(--tg-theme-hint-color)',
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
                color: 'var(--tg-theme-hint-color)'
              }}
              aria-label="Очистить поиск"
            >
              <ClearIcon sx={{ color: 'var(--tg-theme-hint-color)', fontSize: '0.955rem' }} />
            </Box>
          </InputAdornment>
        ) : null,
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: '0.59rem', // 0.236 * 2.5rem ≈ 0.59rem
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          color: 'var(--tg-theme-text-color)',
          height: '2.5rem', // Высота по пропорции
          fontSize: '0.875rem', // 14px
          paddingLeft: '0.618rem', // Отступы по горизонтали
          paddingRight: '0.618rem',
          '&:hover': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--tg-theme-button-color)',
            },
          },
          '&.Mui-focused': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--tg-theme-button-color)',
              borderWidth: 2,
            },
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--tg-theme-border-color)',
          },
        },
        '& .MuiInputBase-input': {
          color: 'var(--tg-theme-text-color)',
          fontSize: '0.875rem',
          '&::placeholder': {
            color: 'var(--tg-theme-hint-color)',
            opacity: 1,
          },
        },
      }}
    />
  );
};
