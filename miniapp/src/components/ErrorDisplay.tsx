import React from 'react';
import { Alert, Box, Button } from '@mui/material';

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onRetry 
}) => {
  return (
    <Box sx={{ p: 2 }}>
      <Alert 
        severity="error" 
        action={
          onRetry && (
            <Button 
              color="inherit" 
              size="small" 
              onClick={onRetry}
            >
              Повторить
            </Button>
          )
        }
      >
        {error}
      </Alert>
    </Box>
  );
};
