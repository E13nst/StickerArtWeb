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
      sx={{ 
        height: '100%',
        minHeight: 220,
        width: '100%',
        maxWidth: 280,
        minWidth: 180,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between', // Равномерное распределение контента
        borderRadius: 3,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          transform: 'translateY(-2px)'
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
              sx={{ 
                fontSize: '1.1rem',
                lineHeight: 1.2,
                flexGrow: 1,
                mr: 1,
                fontWeight: 600 // font-weight: 600
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
                sx={{
                  aspectRatio: '1 / 1',
                  overflow: 'hidden',
                  borderRadius: 1
                }}
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
              sx={{
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'background.paper',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'divider'
              }}
            >
              <Typography 
                color="text.secondary"
                sx={{ fontSize: isSmallScreen ? '1rem' : '1.2rem' }}
              >
                ➕
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Нижняя секция: Дата создания (прижата к низу) */}
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              fontSize: '0.8rem',
              color: 'gray',
              fontWeight: 'medium',
              display: 'block',
              textAlign: 'center'
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
