import React, { useMemo, useCallback } from 'react';
import { Box, Grid } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { StickerCard } from './StickerCard';
import { HeroStickerCard } from './HeroStickerCard';

interface StickerSetListProps {
  stickerSets: StickerSetResponse[];
  onView: (id: number, name: string) => void;
  isInTelegramApp?: boolean;
}

export const StickerSetList: React.FC<StickerSetListProps> = ({
  stickerSets,
  onView,
  isInTelegramApp = false
}) => {
  // Мемоизируем обработчики для предотвращения лишних ре-рендеров
  const handleView = useCallback((id: number, name: string) => {
    onView(id, name);
  }, [onView]);

  // Ограничиваем количество отображаемых элементов для производительности
  const maxVisibleItems = 20; // Показываем максимум 20 элементов за раз
  const visibleStickerSets = useMemo(() => {
    return stickerSets.slice(0, maxVisibleItems);
  }, [stickerSets]);

  console.log('🔍 StickerSetList рендер:', {
    stickerSetsCount: stickerSets.length,
    visibleCount: visibleStickerSets.length,
    isInTelegramApp
  });

  return (
    <Box sx={{ 
      pb: isInTelegramApp ? 2 : 10, // Добавляем отступ для Bottom Navigation
      px: isInTelegramApp ? 0 : 2,  // Боковые отступы на desktop
    }}>
      <Grid container spacing={1.75} sx={{ alignItems: 'stretch' }}>
        {visibleStickerSets.map((stickerSet, index) => {
          console.log('🔍 StickerSetList рендер карточки:', {
            stickerSetId: stickerSet.id,
            stickerSetTitle: stickerSet.title,
            isInTelegramApp
          });
          
          // Hero карточка каждую 6-ю (если есть ≥ 4 превью)
          const shouldShowHero = (index + 1) % 6 === 0 && stickerSet.stickers && stickerSet.stickers.length >= 4;
          
          return (
            <Grid item xs={6} key={stickerSet.id}>
              <Box 
                sx={{ 
                  height: '100%',
                  contentVisibility: 'auto',
                  containIntrinsicSize: '480px'
                }}
                className="content-visibility-auto"
              >
                {shouldShowHero ? (
                  <HeroStickerCard 
                    stickers={stickerSet.stickers.map(s => s.url).slice(0, 4)}
                    style={{ height: '100%' }}
                  />
                ) : (
                  <StickerCard
                    stickerSet={stickerSet}
                    onView={handleView}
                    isInTelegramApp={isInTelegramApp}
                  />
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>
      
      {/* Показываем индикатор, если есть скрытые элементы */}
      {stickerSets.length > maxVisibleItems && (
        <Box sx={{ 
          textAlign: 'center', 
          py: 2,
          color: 'text.secondary',
          fontSize: '0.9rem',
          width: '100%'
        }}>
          Показано {maxVisibleItems} из {stickerSets.length} наборов
        </Box>
      )}
    </Box>
  );
};
