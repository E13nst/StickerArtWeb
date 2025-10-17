import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Загрузка...' 
}) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        py: 4 
      }}
    >
      <CircularProgress size={40} />
      <Typography 
        variant="body2" 
        color="text.secondary" 
        sx={{ mt: 2 }}
      >
        {message}
      </Typography>
    </Box>
  );
};
