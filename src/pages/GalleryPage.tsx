import React from 'react';
import { Box, Container } from '@mui/material';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export const GalleryPage: React.FC = () => {
  return (
    <Box className="space-root fx-safe" sx={{ minHeight: '100vh' }}>
      <Container maxWidth={false} sx={{ 
        maxWidth: 560, 
        mx: 'auto', 
        px: 1.5, 
        pt: 'calc(8px + env(safe-area-inset-top))', 
        pb: 'calc(12px + env(safe-area-inset-bottom))',
        backgroundColor: 'transparent'
      }}>
        <LoadingSpinner message="Загрузка..." />
      </Container>
    </Box>
  );
};