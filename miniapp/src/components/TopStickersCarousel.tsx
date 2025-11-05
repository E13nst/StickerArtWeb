import React from 'react';
import { Box, Typography } from '@mui/material';

interface Sticker {
  id: number | string;
  image?: string;
  emoji?: string;
  likes: number;
  name: string;
  fileId?: string;
  url?: string;
}

interface TopStickersCarouselProps {
  stickers: Sticker[];
  onStickerClick?: (sticker: Sticker) => void;
}

export const TopStickersCarousel: React.FC<TopStickersCarouselProps> = ({
  stickers,
  onStickerClick
}) => {
  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        variant="h6"
        fontWeight="bold"
        sx={{
          color: 'var(--tg-theme-text-color)',
          mb: 2,
          fontSize: { xs: '1rem', sm: '1.25rem' }
        }}
      >
        ТОП-5 СТИКЕРОВ
      </Typography>
      
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--tg-theme-hint-color) transparent',
          '&::-webkit-scrollbar': {
            height: '6px'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'var(--tg-theme-hint-color)',
            borderRadius: '3px'
          }
        }}
      >
        {stickers.map((sticker, index) => (
          <Box
            key={sticker.id}
            onClick={() => onStickerClick?.(sticker)}
            sx={{
              flex: '0 0 auto',
              width: { xs: '100px', sm: '120px' },
              textAlign: 'center',
              cursor: onStickerClick ? 'pointer' : 'default',
              transition: 'transform 0.2s ease',
              '&:hover': onStickerClick ? {
                transform: 'translateY(-4px)'
              } : {}
            }}
          >
            <Box
              sx={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: 2,
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                border: '1px solid var(--tg-theme-border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {sticker.url ? (
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : sticker.emoji ? (
                <Typography sx={{ fontSize: '3rem' }}>{sticker.emoji}</Typography>
              ) : (
                <Typography sx={{ fontSize: '1.5rem', color: 'var(--tg-theme-hint-color)' }}>
                  🎨
                </Typography>
              )}
              
              {/* Бейдж места */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  backgroundColor: 'var(--tg-theme-button-color)',
                  color: 'var(--tg-theme-button-text-color)',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}
              >
                {index + 1}
              </Box>
            </Box>
            
            <Typography
              variant="caption"
              sx={{
                color: 'var(--tg-theme-text-color)',
                fontSize: '0.75rem',
                fontWeight: 500,
                display: 'block',
                mb: 0.5
              }}
            >
              {sticker.name}
            </Typography>
            
            <Typography
              variant="caption"
              sx={{
                color: 'var(--tg-theme-hint-color)',
                fontSize: '0.7rem'
              }}
            >
              {sticker.likes} ❤️
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

