import React, { memo, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { StickerPreview } from './StickerPreview';
import { StickerSetCategories } from './StickerSetCategories';

interface StickerCardProps {
  stickerSet: StickerSetResponse;
  onView: (id: number, name: string) => void;
  isInTelegramApp?: boolean;
}

const StickerCardComponent: React.FC<StickerCardProps> = ({
  stickerSet,
  onView,
  isInTelegramApp = false
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // 🚀 20/80 ОПТИМИЗАЦИЯ: детекция медленного интернета
  const isSlowConnection = (navigator as any).connection?.effectiveType?.includes('2g') || false;
  
  const getStickerCount = useCallback(() => {
    return stickerSet.telegramStickerSetInfo?.stickers?.length || 0;
  }, [stickerSet.telegramStickerSetInfo?.stickers?.length]);

  const getPreviewStickers = useCallback(() => {
    const stickers = stickerSet.telegramStickerSetInfo?.stickers || [];
    return stickers.slice(0, isSlowConnection ? 2 : 4); // Меньше стикеров на медленном интернете
  }, [stickerSet.telegramStickerSetInfo?.stickers, isSlowConnection]);

  const handleCardClick = useCallback(() => {
    onView(stickerSet.id, stickerSet.name);
  }, [onView, stickerSet.id, stickerSet.name]);

  const previewStickers = getPreviewStickers();
  const stickerCount = getStickerCount();

  // Фиксированные настройки для одинакового отображения на всех экранах
  const cardPadding = 1.5; // Фиксированные 12px отступы
  const titleVariant = 'h6'; // Фиксированный размер заголовка
  
  // Размеры стикеров для галереи карточек
  const previewSize = 'small'; // Всегда 100x100px в галерее карточек

  return (
    <Card 
      onClick={handleCardClick}
      className="glass-card sticker-card-enhanced smooth-transition content-visibility-auto"
      sx={{ 
        height: '100%',
        minHeight: 220,
        width: '100%',
        maxWidth: 280,
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between', // Равномерное распределение контента
        borderRadius: 2, // 16px
        boxShadow: 'none',
        backgroundColor: 'transparent',   // фон даёт класс .glass-card
        cursor: 'pointer',
        p: 0,
        // Адаптивность для узких экранов
        '@media (max-width: 380px)': {
          '& .MuiCardContent-root': {
            padding: '6px'
          }
        }
      }}
    >
      <CardContent 
        sx={{ 
          p: cardPadding,
          '&:last-child': { pb: cardPadding },
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'space-between', // Равномерное распределение
          height: '100%'
        }}
      >
        {/* Верхняя секция: Заголовок */}
        <Box>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              mb: 1.5,
              minHeight: 40
            }}
          >
            <Typography 
              variant={titleVariant} 
              component="h3"
              className="card-title"
              sx={{ 
                fontSize: '0.875rem',
                fontWeight: 600,
                textAlign: 'center',
                mb: 0.5,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                color: '#EAF0F8',
                // Мобильные адаптации
                '@media (max-width: 400px)': {
                  fontSize: '0.8rem',
                  WebkitLineClamp: 1
                }
              }}
            >
              {stickerSet.title}
            </Typography>
            <Chip 
              label={`${stickerCount}`}
              size="small"
              variant="outlined"
              sx={{ 
                fontSize: '0.8rem',
                height: 24,
                fontWeight: 'bold'
              }}
            />
          </Box>
        </Box>

        {/* Средняя секция: Превью стикеров */}
        <Box 
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1, // 8px между стикерами
            aspectRatio: '1 / 1',
            minHeight: 180,
            flexGrow: 1, // Занимает доступное пространство
            alignSelf: 'center' // Центрирование
          }}
        >
          {previewStickers.map((sticker, index) => {
            return (
              <Box
                key={sticker.file_id}
                className="glass-slot"
              >
                <StickerPreview 
                  sticker={sticker} 
                  size={previewSize}
                  showBadge={index === 0} // Бейдж только на первом стикере
                  isInTelegramApp={isInTelegramApp}
                />
              </Box>
            );
          })}
          {/* Заполняем пустые ячейки если стикеров меньше 4 */}
          {Array.from({ length: Math.max(0, 4 - previewStickers.length) }).map((_, index) => (
            <Box
              key={`empty-${index}`}
              className="glass-slot"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography 
                color="text.secondary"
                sx={{ fontSize: isSmallScreen ? '1rem' : '1.2rem', opacity: 0.5 }}
              >
                ➕
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Категории стикерсета */}
        {stickerSet.categories && stickerSet.categories.length > 0 && (
          <Box sx={{ mt: 1, mb: 1 }}>
            <StickerSetCategories 
              categories={stickerSet.categories}
              maxVisible={2}
              size="small"
            />
          </Box>
        )}

        {/* Нижняя секция: Дата создания (прижата к низу) */}
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Typography 
            variant="caption" 
            className="card-meta"
            sx={{ 
              fontSize: '0.75rem',
              textAlign: 'center',
              display: 'block',
              color: '#B8C1D3',
              opacity: 0.8,
              // Мобильные адаптации
              '@media (max-width: 400px)': {
                fontSize: '0.7rem'
              }
            }}
          >
            {new Date(stickerSet.createdAt).toLocaleDateString()}
          </Typography>
        </Box>

      </CardContent>
    </Card>
  );
};

// Мемоизируем компонент для предотвращения лишних ре-рендеров
export const StickerCard = memo(StickerCardComponent);
