import React, { useState, useEffect, useRef } from 'react';
import { Card, Box, Typography } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';

interface SinglePreviewCardProps {
  stickerSet: StickerSetResponse;
  onView: (id: number, name: string) => void;
  isInTelegramApp?: boolean;
}

export const SinglePreviewCard: React.FC<SinglePreviewCardProps> = ({
  stickerSet,
  onView,
  isInTelegramApp = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Получаем первые 4 стикера для карусели
  const stickers = stickerSet.telegramStickerSetInfo?.stickers?.slice(0, 4) || [];
  
  // Intersection Observer для определения видимости карточки
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.25 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Карусель изображений (только когда карточка видима)
  useEffect(() => {
    if (!isVisible || stickers.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stickers.length);
    }, 3000); // Смена каждые 3 секунды

    return () => clearInterval(interval);
  }, [isVisible, stickers.length]);

  const handleCardClick = () => {
    onView(stickerSet.id, stickerSet.name);
  };

  const currentSticker = stickers[currentIndex];

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      className="glass-card"
      sx={{
        height: '100%',
        borderRadius: 2, // 16px
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      }}
    >
      {/* Большое превью стикера */}
      <Box sx={{ 
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px'
      }}>
        {currentSticker ? (
          <Box sx={{
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1.5, // 12px
            overflow: 'hidden',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))'
          }}>
            <img
              src={`/api/stickers/${currentSticker.file_id}`}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transition: 'opacity 0.3s ease'
              }}
              loading="lazy"
            />
          </Box>
        ) : (
          <Box sx={{
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1.5,
            backgroundColor: 'rgba(0,0,0,0.05)',
            color: 'text.secondary'
          }}>
            <Typography variant="body2">Нет превью</Typography>
          </Box>
        )}
      </Box>

      {/* Информация о стикерпаке */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            fontWeight: 600,
            mb: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {stickerSet.title}
        </Typography>
        
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'text.secondary',
            display: 'block'
          }}
        >
          {new Date(stickerSet.createdAt).toLocaleDateString('ru-RU')}
        </Typography>

        {/* Индикатор карусели */}
        {stickers.length > 1 && (
          <Box sx={{
            display: 'flex',
            gap: 0.5,
            mt: 1,
            justifyContent: 'center'
          }}>
            {stickers.map((_, index) => (
              <Box
                key={index}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: index === currentIndex 
                    ? 'primary.main' 
                    : 'rgba(0,0,0,0.2)',
                  transition: 'background-color 0.2s ease'
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Card>
  );
};
