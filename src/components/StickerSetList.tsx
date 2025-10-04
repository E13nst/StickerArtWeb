import React, { useMemo, useCallback, useEffect } from 'react';
import { Box, Grid, Button } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { SinglePreviewCard } from './SinglePreviewCard';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { imageCache } from '@/utils/imageCache';

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
  // Поэтапная загрузка: сначала 4, потом по 2 (без задержек)
  const { visibleItems, isLoading, loadNextBatch, hasMore } = useProgressiveLoading(
    stickerSets.length,
    { initialBatch: 4, batchSize: 2 }
  );

  // Мемоизируем обработчики для предотвращения лишних ре-рендеров
  const handleView = useCallback((id: number, name: string) => {
    onView(id, name);
  }, [onView]);

  // Получаем видимые стикерпаки
  const visibleStickerSets = useMemo(() => {
    return stickerSets.slice(0, visibleItems);
  }, [stickerSets, visibleItems]);

  // Предзагружаем изображения для видимых стикерпаков
  useEffect(() => {
    const imageUrls: string[] = [];
    
    visibleStickerSets.forEach(stickerSet => {
      const stickers = stickerSet.telegramStickerSetInfo?.stickers?.slice(0, 3) || [];
      stickers.forEach(sticker => {
        if (sticker.url) {
          imageUrls.push(sticker.url);
        } else {
          imageUrls.push(`/api/stickers/${sticker.file_id}`);
        }
      });
    });

    if (imageUrls.length > 0) {
      console.log('🚀 Предзагружаем изображения:', imageUrls.length);
      imageCache.preloadImages(imageUrls);
    }
  }, [visibleStickerSets]);

  // Автоматическая загрузка при скролле
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || isLoading) return;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.offsetHeight;

      // Загружаем следующую порцию когда дошли до 80% страницы
      if (scrollTop + windowHeight >= docHeight * 0.8) {
        loadNextBatch();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, loadNextBatch]);

  console.log('🔍 StickerSetList рендер:', {
    stickerSetsCount: stickerSets.length,
    visibleCount: visibleStickerSets.length,
    hasMore,
    isLoading,
    isInTelegramApp,
    cacheStats: imageCache.getStats()
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
          
          return (
            <Grid item xs={6} key={stickerSet.id}>
              <Box 
                sx={{ 
                  height: '100%',
                  contentVisibility: 'auto',
                  containIntrinsicSize: '300px'
                }}
                className="content-visibility-auto"
              >
                <SinglePreviewCard
                  stickerSet={stickerSet}
                  onView={handleView}
                  isInTelegramApp={isInTelegramApp}
                />
              </Box>
            </Grid>
          );
        })}
      </Grid>
      
      {/* Индикатор загрузки */}
      {isLoading && (
        <Box sx={{ 
          textAlign: 'center', 
          py: 2,
          color: 'text.secondary',
          fontSize: '0.9rem',
          width: '100%'
        }}>
          Загрузка следующих стикерпаков...
        </Box>
      )}

      {/* Кнопка загрузки еще */}
      {hasMore && !isLoading && (
        <Box sx={{ 
          textAlign: 'center', 
          py: 2,
          width: '100%'
        }}>
          <Button 
            variant="outlined" 
            onClick={loadNextBatch}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              py: 1
            }}
          >
            Показать еще ({stickerSets.length - visibleItems} осталось)
          </Button>
        </Box>
      )}

      {/* Показываем индикатор, если все загружено */}
      {!hasMore && stickerSets.length > 0 && (
        <Box sx={{ 
          textAlign: 'center', 
          py: 2,
          color: 'text.secondary',
          fontSize: '0.9rem',
          width: '100%'
        }}>
          Показаны все {stickerSets.length} стикерпаков
        </Box>
      )}
    </Box>
  );
};
