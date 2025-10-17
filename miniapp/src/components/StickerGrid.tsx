import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { Sticker } from '@/types/sticker';
import { StickerPreview } from './StickerPreview';

interface StickerGridProps {
  stickers: Sticker[];
  onStickerClick?: (sticker: Sticker) => void;
  isInTelegramApp?: boolean;
}

export const StickerGrid: React.FC<StickerGridProps> = ({ 
  stickers, 
  onStickerClick,
  isInTelegramApp = false
}) => {
  if (!stickers || stickers.length === 0) {
    return (
      <Box 
        sx={{ 
          textAlign: 'center', 
          py: 4,
          color: 'text.secondary' 
        }}
      >
        <Typography variant="h6">Стикеры не найдены</Typography>
      </Box>
    );
  }

  // Адаптивная сетка стикеров
  const getGridColumns = () => {
    return { 
      xs: 6,   // <600px: 2 в ряд
      sm: 4,   // 600px+: 3 в ряд  
      md: 3,   // 900px+: 4 в ряд
      lg: 2    // 1200px+: 6 в ряд
    };
  };

  return (
    <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
      {stickers.map((sticker) => (
        <Grid 
          item 
          {...getGridColumns()} 
          key={sticker.file_id}
          sx={{
            minWidth: 100,  // Минимальный размер стикера
            maxWidth: 200,  // Максимальный размер стикера
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <Box
            onClick={() => onStickerClick?.(sticker)}
            sx={{
              cursor: onStickerClick ? 'pointer' : 'default',
              transition: 'transform 0.2s ease',
              width: '100%',
              height: '100%',
              minHeight: 100,
              maxHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': onStickerClick ? {
                transform: 'scale(1.05)'
              } : {}
            }}
          >
            <StickerPreview 
              sticker={sticker} 
              size="large" // Desktop: 160x160px, планшеты: 120x120px, телефоны: 100x100px
              showBadge={true}
              isInTelegramApp={isInTelegramApp}
            />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};
