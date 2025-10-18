import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

// Глобальный кеш для Lottie анимаций
const animationCache = new Map<string, any>();

interface AnimatedStickerProps {
  fileId: string;
  imageUrl: string;
  emoji?: string;
  className?: string;
  hidePlaceholder?: boolean;
}

export const AnimatedSticker: React.FC<AnimatedStickerProps> = ({
  fileId,
  imageUrl,
  emoji,
  className,
  hidePlaceholder
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadAnimation = async () => {
      try {
        setLoading(true);
        setError(false);

        // Проверяем кеш
        if (animationCache.has(fileId)) {
          console.log('🎬 Loaded from cache:', fileId);
          if (!cancelled) {
            setAnimationData(animationCache.get(fileId));
            setLoading(false);
          }
          return;
        }

        // Загружаем JSON анимации
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        
        // Проверяем, что это JSON
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          if (!cancelled) {
            // Сохраняем в кеш
            animationCache.set(fileId, data);
            console.log('🎬 Cached animation:', fileId);
            setAnimationData(data);
          }
        } else {
          // Если это не JSON (например, webp/png), показываем ошибку
          throw new Error('Not a JSON animation');
        }
      } catch (err) {
        console.warn('Failed to load animation:', fileId, err);
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAnimation();

    return () => {
      cancelled = true;
    };
  }, [fileId, imageUrl]);

  if (loading) {
    return (
      <div className={className} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '48px' 
      }}>
        {hidePlaceholder ? null : (emoji || '🎨')}
      </div>
    );
  }

  if (error || !animationData) {
    // Fallback - пробуем показать как обычное изображение
    return (
      <img
        src={imageUrl}
        alt={emoji || ''}
        className={className}
        onError={() => {
          // Если и изображение не загрузилось - показываем эмодзи
        }}
      />
    );
  }

  return (
    <Lottie
      animationData={animationData}
      loop={true}
      autoplay={true}
      className={className}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
};

