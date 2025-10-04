import React, { memo, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
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

  // 🚀 20/80 ОПТИМИЗАЦИЯ: детекция медленного интернета
  const isSlowConnection = (navigator as any).connection?.effectiveType?.includes('2g') || false;
  

  const getPreviewStickers = useCallback(() => {
    const stickers = stickerSet.telegramStickerSetInfo?.stickers || [];
    return stickers.slice(0, isSlowConnection ? 2 : 4); // Меньше стикеров на медленном интернете
  }, [stickerSet.telegramStickerSetInfo?.stickers, isSlowConnection]);

  const handleCardClick = useCallback(() => {
    onView(stickerSet.id, stickerSet.name);
  }, [onView, stickerSet.id, stickerSet.name]);

  const previewStickers = getPreviewStickers();

  // Фиксированные настройки для одинакового отображения на всех экранах
  const cardPadding = 1.5; // Фиксированные 12px отступы
  
  // Размеры стикеров для галереи карточек
  const previewSize = 'large'; // Увеличиваем размер превью для лучшего качества

  return (
    <Card 
      onClick={handleCardClick}
      sx={{ 
        height: '100%',
        borderRadius: 2, // ≈ 16px
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        backgroundColor: 'rgba(255,255,255,0.9)',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.12)'
        },
        // Адаптивность для узких экранов
        '@media (max-width: 380px)': {
          '& .MuiCardContent-root': {
            padding: '6px'
          }
        }
      }}
      className="content-visibility-auto"
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
        {/* Превью стикеров - сверху */}
        <Box 
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
            aspectRatio: '1 / 1',
            mb: 1.25,
            borderRadius: 1.5, // ≈12px
            backgroundColor: '#F6F7F9',
            p: 1.25
          }}
        >
          {previewStickers.map((sticker, index) => {
            return (
              <Box
                key={sticker.file_id}
                sx={{
                  aspectRatio: '1 / 1',
                  overflow: 'hidden',
                  borderRadius: 1, // ≈8px
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#ffffff'
                }}
              >
                <StickerPreview 
                  sticker={sticker} 
                  size={previewSize}
                  showBadge={index === 0}
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
                sx={{ fontSize: '0.8rem' }}
              >
                ➕
              </Typography>
            </Box>
          ))}
        </Box>


        {/* Название стикерсета */}
        <Typography 
          variant="h6" 
          component="h3"
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
            color: '#111827',
            // Мобильные адаптации
            '@media (max-width: 400px)': {
              fontSize: '0.8rem',
              WebkitLineClamp: 1
            }
          }}
        >
          {stickerSet.title}
        </Typography>

        {/* Дата создания */}
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '0.75rem',
            textAlign: 'center',
            display: 'block',
            color: '#6B7280',
            opacity: 0.8,
            // Мобильные адаптации
            '@media (max-width: 400px)': {
              fontSize: '0.7rem'
            }
          }}
        >
          {new Date(stickerSet.createdAt).toLocaleDateString()}
        </Typography>

      </CardContent>
    </Card>
  );
};

// Мемоизируем компонент для предотвращения лишних ре-рендеров
export const StickerCard = memo(StickerCardComponent);
