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
      className="search-minimal"
      sx={{
        display: 'flex',
        alignItems: 'center',
        transition: 'all 0.2s ease',
        '&:focus-within': {
          borderColor: 'rgba(255,255,255,0.25)',
          background: 'transparent',
        },
      }}
    >
      <SearchIcon sx={{ mx: 1.5, fontSize: 20, color: 'rgba(255,255,255,0.7)' }} />
      <InputBase
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        inputProps={{ 'aria-label': 'search-stickers' }}
        sx={{
          flex: 1,
          fontSize: 15,
          color: '#EAF0F8',
          '& ::placeholder': { color: 'rgba(255,255,255,0.5)' },
          '& input': {
            padding: '8px 0',
          },
        }}
      />
    </Box>
  );
};

export default MinimalSearchBar;
