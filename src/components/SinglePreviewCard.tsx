import React, { useState, useEffect, useRef } from 'react';
import { Card, Box, Typography } from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { StickerPreview } from './StickerPreview';

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
  const [isLoading, setIsLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Получаем только первые 3 стикера для карусели
  const stickers = stickerSet.telegramStickerSetInfo?.stickers?.slice(0, 3) || [];
  
  console.log('🔍 SinglePreviewCard:', {
    stickerSetId: stickerSet.id,
    stickerSetTitle: stickerSet.title,
    stickersCount: stickers.length,
    currentIndex,
    currentSticker: stickers[currentIndex]?.file_id
  });
  
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

  // Сбрасываем состояние загрузки при смене изображения
  useEffect(() => {
    setIsLoading(true);
  }, [currentIndex]);

  // Автоматически убираем загрузку через 3 секунды как fallback
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.log('⏰ Timeout fallback - убираем загрузку');
        setIsLoading(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  const handleCardClick = () => {
    onView(stickerSet.id, stickerSet.name);
  };

  const handleImageLoad = () => {
    console.log('✅ Изображение загружено:', stickers[currentIndex]?.file_id);
    setIsLoading(false);
  };

  const handleImageError = () => {
    console.error('❌ Ошибка загрузки изображения:', stickers[currentIndex]?.file_id);
    setIsLoading(false);
  };

  const currentSticker = stickers[currentIndex];

  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      className="fx-glass fx-lite"
      sx={{
        height: '100%',
        borderRadius: 2, // 16px
        cursor: 'pointer',
        backgroundColor: 'transparent', // убираем белый фон MUI
        transition: 'transform 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      }}
    >
      {/* Большое превью стикера */}
      <Box className="fx-card-media" sx={{ 
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        background: 'transparent'
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
            background: 'transparent', // убираем серую подложку
            position: 'relative'
          }}>
            
            <StickerPreview
              sticker={currentSticker}
              size="large"
              style={{
                width: '100%',
                height: '100%'
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
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
      <Box className="fx-card-body" sx={{ px: 1.5, pb: 1.5, background: 'transparent' }}>
        <Typography 
          className="card-title"
          sx={{ 
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
          sx={{ 
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
