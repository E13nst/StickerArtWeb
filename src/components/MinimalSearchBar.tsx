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
        mt: 1.5,
        mb: 1,                 // меньше вертикальные отступы
        px: 0.5,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 44,          // компактная высота
          borderTop: '1px solid rgba(15,23,42,0.10)',
          borderBottom: '1px solid rgba(15,23,42,0.10)',
          transition: 'border-color .2s ease',
          '&:focus-within': {
            borderTopColor: 'rgba(15,23,42,0.18)',
            borderBottomColor: 'rgba(15,23,42,0.18)',
          },
        }}
      >
        <SearchIcon sx={{ mx: 1, fontSize: 20, color: 'rgba(15,23,42,0.45)' }} />
        <InputBase
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          inputProps={{ 'aria-label': 'search-stickers' }}
          sx={{
            flex: 1,
            fontSize: 14.5,
            color: '#0F172A',
            '& ::placeholder': { color: 'rgba(15,23,42,0.45)' },
          }}
        />
      </Box>
    </Box>
  );
};

export default MinimalSearchBar;
