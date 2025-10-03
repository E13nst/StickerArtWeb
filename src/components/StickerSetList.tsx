import React, { useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
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
      display: 'flex',
      justifyContent: 'center'
    }}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 2,
        maxWidth: 520, // Увеличиваем для новых размеров карточек
        width: '100%',
        margin: '0 auto',
        padding: '0 16px 40px',
        // Адаптивность для узких экранов
        '@media (max-width: 600px)': {
          maxWidth: '100%',
          gap: 1.5,
          padding: '0 12px 60px' // Больше места для нижней навигации
        },
        // Очень узкие экраны
        '@media (max-width: 400px)': {
          gap: 1,
          padding: '0 12px 60px'
        }
      }}>
        {visibleStickerSets.map((stickerSet) => {
          console.log('🔍 StickerSetList рендер карточки:', {
            stickerSetId: stickerSet.id,
            stickerSetTitle: stickerSet.title,
            isInTelegramApp
          });
          
          return (
            <Box
              key={stickerSet.id}
              sx={{
                width: '100%',
                maxWidth: 200, // Увеличиваем с 180 до 200
                minWidth: 180, // Увеличиваем с 160 до 180
                display: 'flex',
                justifyContent: 'center',
                // Адаптивность для узких экранов
                '@media (max-width: 600px)': {
                  maxWidth: 180, // Увеличиваем с 160 до 180
                  minWidth: 160 // Увеличиваем с 140 до 160
                },
                // Очень узкие экраны
                '@media (max-width: 400px)': {
                  maxWidth: 170, // Увеличиваем с 150 до 170
                  minWidth: 150 // Увеличиваем с 130 до 150
                }
              }}
            >
              <StickerCard
                stickerSet={stickerSet}
                onView={handleView}
                isInTelegramApp={isInTelegramApp}
              />
            </Box>
          );
        })}
      </Box>
      
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
