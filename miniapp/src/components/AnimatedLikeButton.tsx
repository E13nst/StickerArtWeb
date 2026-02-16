import { useState, useCallback, FC } from 'react';
import { FavoriteIcon } from '@/components/ui/Icons';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface AnimatedLikeButtonProps {
  packId: string;
  initialLiked: boolean;
  initialLikesCount: number;
  onLike: (packId: string, isLiked: boolean) => void;
  size?: 'small' | 'medium' | 'large';
}

export const AnimatedLikeButton: FC<AnimatedLikeButtonProps> = ({
  packId,
  initialLiked,
  initialLikesCount,
  onLike,
  size = 'medium'
}) => {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isAnimating, setIsAnimating] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  
  const { hapticLike, hapticSuccess } = useHapticFeedback();

  // Обработка лайка
  const handleLike = useCallback(() => {
    const newLiked = !isLiked;
    const newCount = newLiked ? likesCount + 1 : likesCount - 1;
    
    setIsLiked(newLiked);
    setLikesCount(newCount);
    setIsAnimating(true);
    
    // Haptic feedback
    if (newLiked) {
      hapticLike();
    } else {
      hapticSuccess();
    }
    
    // Создаем частицы для анимации
    if (newLiked) {
      const newParticles = Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: i * 50
      }));
      setParticles(newParticles);
    }
    
    // Вызываем callback
    onLike(packId, newLiked);
    
    // Сброс анимации
    setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 600);
  }, [isLiked, likesCount, packId, onLike, hapticLike, hapticSuccess]);

  // Размеры кнопки
  const sizeMap = {
    small: { width: '32px', height: '32px', fontSize: '14px' },
    medium: { width: '40px', height: '40px', fontSize: '16px' },
    large: { width: '48px', height: '48px', fontSize: '18px' }
  };

  const buttonSize = sizeMap[size];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Основная кнопка */}
      <button
        onClick={handleLike}
        disabled={isAnimating}
        style={{
          width: buttonSize.width,
          height: buttonSize.height,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: isLiked 
            ? 'var(--tg-theme-button-color)' 
            : 'var(--tg-theme-secondary-bg-color)',
          color: isLiked 
            ? 'var(--tg-theme-button-text-color)' 
            : 'var(--tg-theme-text-color)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: buttonSize.fontSize,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isAnimating ? 'scale(1.2)' : 'scale(1)',
          boxShadow: isAnimating 
            ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
            : '0 2px 4px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Иконка сердечка */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isAnimating ? 'scale(1.3)' : 'scale(1)',
            transition: 'transform 0.2s ease'
          }}
        >
          <FavoriteIcon size={parseInt(buttonSize.fontSize)} color={isLiked ? '#ff6b6b' : '#ffffff'} />
        </span>

        {/* Счетчик лайков */}
        {likesCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              backgroundColor: 'var(--tg-theme-error-color)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '10px',
              minWidth: '16px',
              textAlign: 'center',
              transform: isAnimating ? 'scale(1.2)' : 'scale(1)',
              transition: 'transform 0.2s ease'
            }}
          >
            {likesCount}
          </span>
        )}

        {/* Эффект пульсации */}
        {isAnimating && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: isLiked 
                ? 'rgba(255, 0, 0, 0.3)' 
                : 'rgba(0, 0, 0, 0.1)',
              transform: 'translate(-50%, -50%) scale(0)',
              animation: 'pulse 0.6s ease-out'
            }}
          />
        )}
      </button>

      {/* Частицы для анимации */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: '4px',
            height: '4px',
            backgroundColor: 'var(--tg-theme-button-color)',
            borderRadius: '50%',
            pointerEvents: 'none',
            animation: `particle-${particle.id} 0.6s ease-out forwards`,
            animationDelay: `${particle.delay}ms`
          }}
        />
      ))}

      {/* CSS анимации */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
          }
          
          @keyframes particle-${particles[0]?.id || 'default'} {
            0% { 
              transform: translate(0, 0) scale(1); 
              opacity: 1; 
            }
            100% { 
              transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) scale(0); 
              opacity: 0; 
            }
          }
        `}
      </style>
    </div>
  );
};
