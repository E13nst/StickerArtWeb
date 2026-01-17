import React from 'react';
import { Box, Typography } from '@mui/material';
import { PackCard } from './PackCard';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { StickerSetResponse } from '@/types/sticker';

interface StickersCarouselProps {
  title: string;
  stickerSets: StickerSetResponse[];
  onPackClick?: (packId: string) => void;
  variant?: 'official' | 'custom';
}

export const StickersCarousel: React.FC<StickersCarouselProps> = ({
  title,
  stickerSets,
  onPackClick,
  variant = 'official'
}) => {
  const packs = React.useMemo(() => {
    return adaptStickerSetsToGalleryPacks(stickerSets.slice(0, 3));
  }, [stickerSets]);

  const backgroundColor = variant === 'official' 
    ? 'rgba(238, 68, 159, 0.2)' 
    : 'rgba(169, 70, 181, 0.2)';

  if (packs.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        width: '177px',
        height: '249px', // Фиксированная высота по дизайну Figma
        backgroundColor,
        borderRadius: '16px',
        padding: '8px', // По дизайну Figma
        display: 'flex',
        flexDirection: 'column',
        gap: '8px', // Уменьшенный gap по дизайну
        alignItems: 'center'
      }}
    >
      {/* Заголовок */}
      <Typography
        sx={{
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
          textAlign: 'center',
          lineHeight: '22px'
        }}
      >
        {title}
      </Typography>

      {/* Горизонтальная карусель */}
      <Box
        sx={{
          display: 'flex',
          gap: '8px', // Уменьшенный gap по дизайну
          overflowX: 'auto',
          overflowY: 'hidden',
          width: '100%',
          flex: 1,
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          '&::-webkit-scrollbar': {
            display: 'none' // Chrome/Safari
          },
          // Snapping для лучшего UX
          scrollSnapType: 'x mandatory',
          '& > *': {
            scrollSnapAlign: 'start',
            flexShrink: 0
          }
        }}
      >
        {packs.map((pack) => (
          <Box
            key={pack.id}
            sx={{
              width: '161px',
              height: '189px', // Фиксированная высота по дизайну Figma
              flexShrink: 0
            }}
          >
            <PackCard pack={pack} onClick={onPackClick} />
          </Box>
        ))}
      </Box>
    </Box>
  );
};
