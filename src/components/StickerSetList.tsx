import React, { useMemo, useCallback, useEffect, useRef } from 'react';
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
  // Поэтапная загрузка: сначала 6, потом по 2 (без задержек)
  const { visibleItems, isLoading, loadNextBatch, loadUpToIndex, hasMore } = useProgressiveLoading(
    stickerSets.length,
    { initialBatch: 6, batchSize: 2 }
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Мемоизируем обработчики для предотвращения лишних ре-рендеров
  const handleView = useCallback((id: number, name: string) => {
    onView(id, name);
  }, [onView]);

  // Получаем видимые стикерпаки
  const visibleStickerSets = useMemo(() => {
    return stickerSets.slice(0, visibleItems);
  }, [stickerSets, visibleItems]);

  // Предзагружаем изображения только для видимых стикерпаков
  useEffect(() => {
    const imageUrls: string[] = [];
    
    // Загружаем только для первых 6 карточек для оптимизации
    const cardsToPreload = visibleStickerSets.slice(0, 6);
    
    cardsToPreload.forEach(stickerSet => {
      const stickers = (stickerSet.telegramStickerSetInfo?.stickers || stickerSet.stickers || []).slice(0, 1);
      stickers.forEach(sticker => {
        // Предзагружаем только обычные изображения, не Lottie
        if (!sticker.is_animated) {
          if (sticker.url) {
            imageUrls.push(sticker.url);
          } else {
            imageUrls.push(`/api/stickers/${sticker.file_id}`);
          }
        }
      });
    });

    if (imageUrls.length > 0) {
      console.log(`🚀 Предзагружаем изображения для ${cardsToPreload.length} карточек:`, imageUrls.length);
      imageCache.preloadImages(imageUrls);
    }
  }, [visibleStickerSets]);

  // IntersectionObserver для приоритетной загрузки карточек и изображений
  useEffect(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const cardElement = entry.target as HTMLElement;
              const stickerSetId = parseInt(cardElement.dataset.stickerSetId || '0');
              const stickerSetIndex = stickerSets.findIndex(s => s.id === stickerSetId);
              const stickerSet = stickerSets.find(s => s.id === stickerSetId);
              
              if (stickerSet && stickerSetIndex !== -1) {
                // Приоритетная загрузка: если карточка видна, загружаем её и все предыдущие
                console.log(`🎯 Приоритетная загрузка: карточка ${stickerSet.title} (индекс ${stickerSetIndex}) стала видимой`);
                loadUpToIndex(stickerSetIndex);
                
                // Предзагружаем изображение
                const stickers = (stickerSet.telegramStickerSetInfo?.stickers || stickerSet.stickers || []).slice(0, 1);
                stickers.forEach(sticker => {
                  if (!sticker.is_animated) {
                    const imageUrl = sticker.url || `/api/stickers/${sticker.file_id}`;
                    console.log(`🔄 Загрузка изображения для ${stickerSet.title}:`, imageUrl);
                    imageCache.preloadImages([imageUrl]);
                  }
                });
                
                // Отключаем наблюдение после загрузки
                observerRef.current?.unobserve(cardElement);
              }
            }
          });
        },
        { rootMargin: '100px' } // Увеличиваем зону предзагрузки
      );
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [stickerSets, loadUpToIndex]);

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
        {stickerSets.map((stickerSet, index) => {
          const isVisible = index < visibleItems;
          
          console.log('🔍 StickerSetList рендер карточки:', {
            stickerSetId: stickerSet.id,
            stickerSetTitle: stickerSet.title,
            index,
            isVisible,
            isInTelegramApp
          });
          
          return (
            <Grid item xs={6} key={stickerSet.id}>
              <Box 
                data-sticker-set-id={stickerSet.id}
                ref={(el) => {
                  if (el && observerRef.current) {
                    observerRef.current.observe(el);
                  }
                }}
                sx={{ 
                  height: '100%',
                  contentVisibility: 'auto',
                  containIntrinsicSize: '300px',
                  // Скрываем невидимые карточки, но оставляем их в DOM для IntersectionObserver
                  visibility: isVisible ? 'visible' : 'hidden',
                  opacity: isVisible ? 1 : 0
                }}
                className="content-visibility-auto"
              >
                {isVisible && (
                  <SinglePreviewCard
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
