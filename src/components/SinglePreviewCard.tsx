import React, { useState, useEffect, useRef } from 'react';
import { Card, Box, Typography } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { StickerPreview } from './StickerPreview';

// Функция для перемешивания массива в случайном порядке
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
  const [isLoading, setIsLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Получаем максимум 3 случайных стикера для карусели
  const allStickers = stickerSet.stickers || [];
  const shuffledStickers = shuffleArray(allStickers);
  const carouselStickers = shuffledStickers.slice(0, 3);

  // IntersectionObserver для активации карусели только при видимости
  useEffect(() => {
    const card = cardRef.current;
    if (!card || carouselStickers.length < 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Запускаем карусель с интервалом 2.5 секунд
          intervalRef.current = setInterval(() => {
            setCurrentIndex((prevIndex) => 
              prevIndex === carouselStickers.length - 1 ? 0 : prevIndex + 1
            );
          }, 2500);
        } else {
          // Останавливаем карусель при скрытии
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(card);

    return () => {
      observer.disconnect();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [carouselStickers.length]);

  // Fallback таймер для скрытия загрузки
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    console.error('❌ Ошибка отображения изображения:', carouselStickers[currentIndex]?.file_id);
    setIsLoading(false);
  };

  const handleCardClick = () => {
    onView(stickerSet.id, stickerSet.name);
  };

  const currentSticker = carouselStickers[currentIndex];

  return (
    <Card
      ref={cardRef}
      className="fx-glass fx-lite"
      onClick={handleCardClick}
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
        },
        backgroundColor: 'transparent'
      }}
    >
      <Box className="fx-card-media" sx={{ 
        position: 'relative',
        aspectRatio: '1/1',
        background: 'transparent'
      }}>
        {currentSticker && (
          <Box sx={{ 
            width: '100%', 
            height: '100%',
            background: 'transparent'
          }}>
            <StickerPreview
              sticker={currentSticker}
              isAnimated={currentSticker.is_animated}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </Box>
        )}
        
        {/* Индикатор карусели */}
        {carouselStickers.length > 1 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              display: 'flex',
              gap: 0.5,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 1,
              px: 1,
              py: 0.5
            }}
          >
            {carouselStickers.map((_, index) => (
              <Box
                key={index}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: index === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
                  transition: 'background-color 0.2s ease'
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      <Box className="fx-card-body" sx={{ p: 1.5, background: 'transparent' }}>
        <Typography 
          className="card-title"
          variant="h6" 
          sx={{ 
            fontSize: '1rem',
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
          className="card-meta"
          variant="body2" 
          color="text.secondary"
          sx={{ 
            fontSize: '0.875rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {stickerSet.stickers?.length || 0} стикеров
        </Typography>
      </Box>
    </Card>
  );
};