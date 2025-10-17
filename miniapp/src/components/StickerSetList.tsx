import React, { useMemo, useCallback } from 'react';
import { Grid, Box, useTheme, useMediaQuery } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { StickerCard } from './StickerCard';

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
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Мемоизируем обработчики для предотвращения лишних ре-рендеров
  const handleView = useCallback((id: number, name: string) => {
    onView(id, name);
  }, [onView]);

  // Адаптивные настройки спейсинга - мемоизируем
  const spacing = useMemo(() => {
    return isSmallScreen ? 2 : 3; // 16px на мобилках, 24px на десктопе
  }, [isSmallScreen]);

  // Ограничиваем количество отображаемых элементов для производительности
  const maxVisibleItems = 20; // Показываем максимум 20 элементов за раз
  const visibleStickerSets = useMemo(() => {
    return stickerSets.slice(0, maxVisibleItems);
  }, [stickerSets]);

  console.log('🔍 StickerSetList рендер:', {
    stickerSetsCount: stickerSets.length,
    visibleCount: visibleStickerSets.length,
    isInTelegramApp,
    isSmallScreen,
    spacing
  });

  return (
    <Box sx={{ 
      pb: isInTelegramApp ? 2 : 10, // Добавляем отступ для Bottom Navigation
      px: isInTelegramApp ? 0 : 2    // Боковые отступы на desktop
    }}>
      <Grid container spacing={spacing}>
        {visibleStickerSets.map((stickerSet) => {
          console.log('🔍 StickerSetList рендер карточки:', {
            stickerSetId: stickerSet.id,
            stickerSetTitle: stickerSet.title,
            isInTelegramApp
          });
          
          return (
            <Grid 
              item 
              xs={6}     // <600px: 2 карточки (50% каждая)
              sm={4}     // 600px+: 3 карточки (33% каждая)
              md={3}     // 900px+: 4 карточки (25% каждая)
              lg={2.4}   // 1200px+: 5 карточек (20% каждая)
              xl={2.4}   // 1536px+: 5 карточек (20% каждая)
              key={stickerSet.id}
              sx={{
                minWidth: 240,  // Минимальная ширина карточки для desktop
                maxWidth: 280,  // Максимальная ширина карточки
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <StickerCard
                stickerSet={stickerSet}
                onView={handleView}
                isInTelegramApp={isInTelegramApp}
              />
            </Grid>
          );
        })}
      </Grid>
      
      {/* Показываем индикатор, если есть скрытые элементы */}
      {stickerSets.length > maxVisibleItems && (
        <Box sx={{ 
          textAlign: 'center', 
          py: 2,
          color: 'text.secondary'
        }}>
          <Box component="span" sx={{ fontSize: '0.875rem' }}>
            Показано {maxVisibleItems} из {stickerSets.length} наборов
          </Box>
        </Box>
      )}
    </Box>
  );
};
