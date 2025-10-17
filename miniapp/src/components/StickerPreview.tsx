import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import Lottie from 'lottie-react';
import { Sticker } from '@/types/sticker';
import { LazyImage } from './LazyImage';

interface StickerPreviewProps {
  sticker: Sticker;
  size?: 'small' | 'medium' | 'large' | 'auto' | 'responsive';
  showBadge?: boolean;
  isInTelegramApp?: boolean;
}

const StickerPreviewComponent: React.FC<StickerPreviewProps> = ({ 
  sticker, 
  size = 'medium',
  showBadge: _showBadge = true,
  isInTelegramApp = false
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [animationData, setAnimationData] = useState<any>(null);
  const lottieRef = useRef<any>(null);

  const sizeMap = {
    small: { width: 100, height: 100, fontSize: 20 },   // Галерея карточек: 100x100px
    medium: { width: 120, height: 120, fontSize: 24 },   // Планшеты: 120x120px
    large: { width: 160, height: 160, fontSize: 28 }       // Desktop: 160x160px
  };

  // Адаптивные размеры в зависимости от платформы
  const getAdaptiveSize = () => {
    if (size === 'responsive') {
      // Responsive - заполняет весь контейнер
      return { width: '100%', height: '100%', fontSize: 16 };
    }
    
    if (size === 'auto') {
      // В Telegram - компактнее, в браузере - крупнее
      if (isInTelegramApp) {
        console.log('🔍 StickerPreview: Telegram режим, размер medium (120x120)');
        return sizeMap.medium; // 120x120 в Telegram
      } else {
        console.log('🔍 StickerPreview: Браузер режим, размер large (200x200)');
        return sizeMap.large; // 200x200 в браузере
      }
    }
    return sizeMap[size] || sizeMap.medium;
  };

  const currentSize = getAdaptiveSize();
  
  console.log('🔍 StickerPreview рендер:', {
    size,
    isInTelegramApp,
    currentSize,
    stickerId: sticker.file_id
  });

  useEffect(() => {
    if (sticker.is_animated) {
      loadLottieAnimation();
    } else {
      setIsLoaded(true);
    }
  }, [sticker]);

  const loadLottieAnimation = async () => {
    try {
      const response = await fetch(`/api/stickers/${sticker.file_id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnimationData(data);
      setIsLoaded(true);
    } catch (error) {
      console.error('❌ Ошибка загрузки Lottie анимации:', error);
      setError(true);
      setIsLoaded(true);
    }
  };

  const handleImageError = useCallback(() => {
    console.error('❌ Ошибка загрузки изображения:', `/api/stickers/${sticker.file_id}`);
    setError(true);
  }, [sticker.file_id]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  if (error) {
    return (
      <Box
        sx={{
          width: currentSize.width,
          height: currentSize.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography
          sx={{
            fontSize: currentSize.fontSize,
            color: 'text.secondary'
          }}
        >
          {sticker.emoji || '🎨'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: currentSize.width,
        height: currentSize.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      {/* Placeholder */}
      {!isLoaded && (
        <Typography
          sx={{
            fontSize: currentSize.fontSize,
            color: 'text.secondary'
          }}
        >
          {sticker.emoji || '🎨'}
        </Typography>
      )}

      {/* Обычный стикер с ленивой загрузкой */}
      {!sticker.is_animated && (
        <LazyImage
          src={`/api/stickers/${sticker.file_id}`}
          alt={sticker.emoji || 'sticker'}
          onLoad={handleImageLoad}
          onError={handleImageError}
          placeholder={
            <Typography
              sx={{
                fontSize: currentSize.fontSize,
                color: 'text.secondary'
              }}
            >
              {sticker.emoji || '🎨'}
            </Typography>
          }
          fallback={
            <Typography
              sx={{
                fontSize: currentSize.fontSize,
                color: 'text.secondary'
              }}
            >
              {sticker.emoji || '🎨'}
            </Typography>
          }
        />
      )}

      {/* Анимированный стикер */}
      {sticker.is_animated && animationData && (
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
          style={{
            width: '100%',
            height: '100%'
          }}
          lottieRef={lottieRef}
        />
      )}

    </Box>
  );
};

// Мемоизируем компонент для предотвращения лишних ре-рендеров
export const StickerPreview = memo(StickerPreviewComponent);
