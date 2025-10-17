import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  onAction
}) => {
  return (
    <Box 
      sx={{ 
        textAlign: 'center', 
        py: 4,
        px: 2
      }}
    >
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      <Typography 
        variant="body1" 
        color="text.secondary" 
        sx={{ mb: 3 }}
      >
        {message}
      </Typography>
      {actionLabel && onAction && (
        <Button 
          variant="contained" 
          onClick={onAction}
          size="large"
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};
