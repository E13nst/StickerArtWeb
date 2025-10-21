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

        // Проверяем валидность URL
        if (!imageUrl || imageUrl === '') {
          console.log('🎬 Invalid imageUrl, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }

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
          // Если 404 или другая ошибка, сразу переходим к fallback
          console.log('🎬 Animation not found, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
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
          console.log('🎬 Not a JSON animation, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
          }
        }
      } catch (err) {
        console.log('🎬 Failed to load animation, using fallback:', fileId, err);
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
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          // Если и изображение не загрузилось - показываем эмодзи
          console.log('🎬 Image fallback failed, showing emoji:', fileId);
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 48px;">${emoji || '🎨'}</div>`;
          }
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

