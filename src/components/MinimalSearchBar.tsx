import React from 'react';
import { Box, InputBase } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface MinimalSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MinimalSearchBar: React.FC<MinimalSearchBarProps> = ({ 
  value = '', 
  onChange,
  placeholder = "Поиск стикеров…",
  disabled = false
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 48, // Slightly taller for better touch target
        borderTop: '1px solid rgba(15,23,42,0.08)',
        borderBottom: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.2s ease',
        '&:focus-within': {
          borderTopColor: 'rgba(15,23,42,0.15)',
          borderBottomColor: 'rgba(15,23,42,0.15)',
          backgroundColor: 'rgba(255,255,255,0.9)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        },
      }}
    >
      <SearchIcon sx={{ mx: 1.5, fontSize: 20, color: 'rgba(15,23,42,0.45)' }} />
      <InputBase
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputProps={{ 'aria-label': 'search-stickers' }}
        sx={{
          flex: 1,
          fontSize: 15,
          color: '#0F172A',
          '& ::placeholder': { color: 'rgba(15,23,42,0.45)' },
          '& input': {
            padding: '8px 0',
          },
        }}
      />
    </Box>
  );
};

export default MinimalSearchBar;
