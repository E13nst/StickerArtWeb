import React, { useCallback, useState } from 'react';
import { useLikesStore } from '../store/useLikesStore';
import { useTelegram } from '../hooks/useTelegram';

interface InteractiveLikeCountProps {
  packId: string;
  size?: 'small' | 'medium' | 'large';
}

// SVG компонент для иконки лайка с обрезкой по контуру сердца
const LikeIcon: React.FC<{ 
  color: string; 
  size: number; 
  isLiked: boolean; 
}> = ({ color, size, isLiked }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="heartClip">
          <path d="M100.832,141.398c-1.4,0-2.8-0.6-3.8-1.6l-37.2-37.2c-0.8-0.8-0.8-2,0-2.8c0.8-0.8,2-0.8,2.8,0l37.2,37.2
            c0.5,0.5,1.4,0.5,2,0l37.2-37.2c0.8-0.8,2-0.8,2.8,0c0.8,0.8,0.8,2,0,2.8l-37.2,37.2
            C103.632,140.798,102.232,141.398,100.832,141.398z M54.832,86.998c-1.1,0-2-0.9-2-2c0-14.9,12.1-27,27-27c8.7,0,17,4.3,22,11.4c0.6,0.9,0.4,2.2-0.5,2.8
            s-2.1,0.4-2.8-0.5c-4.2-6.1-11.3-9.7-18.7-9.7c-12.7,0-23,10.3-23,23C56.832,86.098,55.932,86.998,54.832,86.998z M145.832,86.998c-1.1,0-2-0.9-2-2c0-12.7-10.3-23-23-23c-7.4,0-14.5,3.6-18.8,9.7c-0.6,0.9-1.9,1.1-2.8,0.5
            c-0.9-0.6-1.1-1.9-0.5-2.8c5.1-7.1,13.3-11.4,22.1-11.4c14.9,0,27,12.1,27,27C147.832,86.098,146.932,86.998,145.832,86.998z"/>
        </clipPath>
      </defs>
      <rect 
        width="200" 
        height="200" 
        fill={isLiked ? '#ff6b6b' : color}
        clipPath="url(#heartClip)"
      />
    </svg>
  );
};

export const InteractiveLikeCount: React.FC<InteractiveLikeCountProps> = ({
  packId,
  size = 'medium'
}) => {
  const { tg } = useTelegram();
  const [isAnimating, setIsAnimating] = useState(false);

  // Подписываемся на изменения конкретного лайка через селектор
  const { likesCount, isLiked } = useLikesStore((state) => {
    const likeState = state.likes[packId] || { packId, isLiked: false, likesCount: 0 };
    console.log(`🔍 DEBUG InteractiveLikeCount [${packId}]:`, likeState);
    return likeState;
  });
  const toggleLike = useLikesStore((state) => state.toggleLike);

  const sizeStyles = {
    small: {
      iconSize: 34,
      fontSize: '10px'
    },
    medium: {
      iconSize: 55,
      fontSize: '11px'
    },
    large: {
      iconSize: 89,
      fontSize: '12px'
    }
  };

  const currentSize = sizeStyles[size];
  
  const getThemeColor = () => {
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-bg-color').trim();
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-text-color').trim();
    
    if (bgColor && textColor) {
      const isDark = bgColor.includes('#') ? 
        parseInt(bgColor.replace('#', ''), 16) < 0x808080 : 
        bgColor.includes('dark') || bgColor.includes('black');
      
      return isDark ? '#ffffff' : '#6b7280';
    }
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? '#ffffff' : '#6b7280';
  };

  // Обработчик клика на лайк
  const handleLikeClick = useCallback(async (e: React.MouseEvent) => {
    // Останавливаем propagation, чтобы не открывалась модалка стикера
    e.stopPropagation();
    e.preventDefault();

    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }

    // Запускаем анимацию
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 233); // Число Фибоначчи

    // Переключаем состояние лайка в store (асинхронно с API)
    try {
      await toggleLike(packId);
    } catch (error) {
      console.error('Ошибка при лайке:', error);
      // UI уже откатится автоматически в store при ошибке
    }
  }, [packId, toggleLike, tg]);

  return (
    <div
      data-testid="interactive-like-button"
      onClick={handleLikeClick}
      style={{
        position: 'absolute',
        top: '1px',
        right: '1px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${currentSize.iconSize}px`,
        height: `${currentSize.iconSize}px`,
        zIndex: 3,
        transition: 'all 0.233s ease',
        pointerEvents: 'auto', // Делаем кликабельным!
        cursor: 'pointer',
        transform: isAnimating ? 'scale(1.15)' : 'scale(1)',
        filter: isAnimating ? 'brightness(1.2)' : 'brightness(1)'
      }}
      title={isLiked ? `${likesCount} лайков (нажмите чтобы убрать)` : `${likesCount} лайков (нажмите чтобы лайкнуть)`}
    >
      {/* Иконка на заднем слое */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        transition: 'transform 0.233s ease',
        transform: isAnimating ? 'rotate(15deg)' : 'rotate(0deg)'
      }}>
        <LikeIcon 
          color={getThemeColor()} 
          size={currentSize.iconSize} 
          isLiked={isLiked}
        />
      </div>
      
      {/* Число лайков поверх иконки */}
      <span style={{
        position: 'relative',
        fontSize: currentSize.fontSize,
        color: isLiked ? '#ffffff' : getThemeColor(),
        fontWeight: '600',
        lineHeight: 1,
        textAlign: 'center',
        zIndex: 2,
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
        transform: 'translateY(-2px)',
        transition: 'color 0.233s ease'
      }}>
        {likesCount}
      </span>

      {/* Анимация пульсации при лайке */}
      {isAnimating && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: isLiked ? 'rgba(255, 107, 107, 0.5)' : 'rgba(128, 128, 128, 0.3)',
            transform: 'translate(-50%, -50%) scale(0)',
            animation: 'like-pulse 0.6s ease-out',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
      )}

      {/* CSS анимация */}
      <style>{`
        @keyframes like-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

