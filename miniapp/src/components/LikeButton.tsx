import { useState, useCallback, useEffect, FC, MouseEvent } from 'react';
import { FavoriteIcon } from '@/components/ui/Icons';

interface LikeButtonProps {
  packId: string;
  initialLiked?: boolean;
  initialLikesCount?: number;
  onLike?: (packId: string, isLiked: boolean) => void;
  size?: 'small' | 'medium' | 'large';
}

export const LikeButton: FC<LikeButtonProps> = ({
  packId,
  initialLiked = false,
  initialLikesCount = 0,
  onLike,
  size = 'medium'
}) => {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isAnimating, setIsAnimating] = useState(false);

  // Обновляем состояние при изменении пропсов
  useEffect(() => {
    setIsLiked(initialLiked);
    setLikesCount(initialLikesCount);
  }, [initialLiked, initialLikesCount]);

  const handleLike = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => prev + (newLikedState ? 1 : -1));
    
    // Анимация
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    
    // Вызываем колбэк
    if (onLike) {
      onLike(packId, newLikedState);
    }
  }, [packId, isLiked, onLike]);

  const sizeStyles = {
    small: {
      width: '24px',
      height: '24px',
      fontSize: '12px'
    },
    medium: {
      width: '32px',
      height: '32px',
      fontSize: '16px'
    },
    large: {
      width: '40px',
      height: '40px',
      fontSize: '20px'
    }
  };

  const currentSize = sizeStyles[size];

  return (
    <div
      style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        background: 'var(--tg-theme-overlay-color)',
        borderRadius: '50%',
        width: currentSize.width,
        height: currentSize.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        border: 'none',
        zIndex: 3,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        transform: isAnimating ? 'scale(1.2)' : 'scale(1)'
      }}
      title={`${isLiked ? 'Убрать лайк' : 'Лайкнуть'} (${likesCount})`}
      onClick={handleLike}
    >
      <div style={{
        fontSize: currentSize.fontSize,
        color: isLiked ? '#ff6b6b' : '#ffffff',
        transition: 'all 0.2s ease',
        transform: isAnimating ? 'scale(1.3)' : 'scale(1)'
      }}>
        <FavoriteIcon size={parseInt(currentSize.fontSize)} color={isLiked ? '#ff6b6b' : '#ffffff'} />
      </div>
      
      {/* Счетчик лайков для больших размеров */}
      {size === 'large' && likesCount > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '-8px',
          right: '-8px',
          background: 'var(--tg-theme-button-color)',
          color: 'white',
          borderRadius: '10px',
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 'bold',
          minWidth: '16px',
          textAlign: 'center'
        }}>
          {likesCount}
        </div>
      )}
    </div>
  );
};
