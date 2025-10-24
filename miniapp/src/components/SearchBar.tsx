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
    <Box sx={{ mb: 2 }}>
      <TextField
        fullWidth
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
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
                  color={disabled ? "disabled" : "action"} 
                  sx={{ 
                    color: disabled ? 'var(--tg-theme-hint-color)' : 'var(--tg-theme-hint-color)',
                    opacity: disabled ? 0.5 : 1
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
                <ClearIcon fontSize="small" sx={{ color: 'var(--tg-theme-hint-color)' }} />
              </Box>
            </InputAdornment>
          ) : null,
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
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
            '&::placeholder': {
              color: 'var(--tg-theme-hint-color)',
              opacity: 1,
            },
          },
          '& .MuiInputBase-input::placeholder': {
            color: 'var(--tg-theme-hint-color)',
            opacity: 1,
          },
        }}
      />
    </Box>
  );
};
