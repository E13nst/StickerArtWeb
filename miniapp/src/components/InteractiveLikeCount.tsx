import { useCallback, useState, useEffect, useRef, CSSProperties, FC, MouseEvent } from 'react';
import { FavoriteIcon } from '@/components/ui/Icons';
import { useLikesStore } from '../store/useLikesStore';
import { useTelegram } from '../hooks/useTelegram';

interface InteractiveLikeCountProps {
  packId: string;
  size?: 'small' | 'medium' | 'large';
  placement?: 'top-right' | 'bottom-center';
  showCount?: boolean;
}

// Обёртка над FavoriteIcon с поддержкой isLiked-состояния
const LikeIcon: FC<{
  size: number;
  isLiked: boolean;
}> = ({ size, isLiked }) => (
  <FavoriteIcon size={size} color={isLiked ? '#ee449f' : '#2a2a2a'} />
);

export const InteractiveLikeCount: FC<InteractiveLikeCountProps> = ({
  packId,
  size = 'medium',
  placement = 'top-right',
  showCount = true
}) => {
  const { tg } = useTelegram();
  const [isAnimating, setIsAnimating] = useState(false);

  // Подписываемся на изменения конкретного лайка через селектор
  // Селектор возвращает только нужные поля для конкретного packId
  // Используем shallow сравнение, чтобы компонент обновлялся только при реальных изменениях
  const { likesCount, isLiked, syncing, error } = useLikesStore((state) => {
    const likeState = state.likes[packId] || { packId, isLiked: false, likesCount: 0, syncing: false };
    return { 
      likesCount: likeState.likesCount, 
      isLiked: likeState.isLiked,
      syncing: likeState.syncing || false,
      error: likeState.error
    };
  }, (a, b) => 
    a.likesCount === b.likesCount && 
    a.isLiked === b.isLiked && 
    a.syncing === b.syncing &&
    a.error === b.error
  );
  
  const toggleLike = useLikesStore((state) => state.toggleLike);

  const sizeStyles = {
    small: {
      iconSize: 36,
      fontSize: '10px'
    },
    medium: {
      iconSize: 68,
      fontSize: '12px'
    },
    large: {
      iconSize: 96,
      fontSize: '12px'
    }
  };

  const currentSize = sizeStyles[size];
  const baseIconSize = currentSize.iconSize;
  const visualIconSize = placement === 'bottom-center' ? baseIconSize * 1.18 : baseIconSize * 0.42;
  const heartIconSize = placement === 'bottom-center' ? baseIconSize * 0.82 : baseIconSize * 0.75;
  
  const getTextColor = () => isLiked ? '#ffffff' : '#ffffff';

  // Обработчик клика на лайк
  const handleLikeClick = useCallback(async (e: MouseEvent) => {
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

  const positionStyles: CSSProperties =
    placement === 'bottom-center'
      ? {
          bottom: 'clamp(12px, 4vw, 22px)',
          left: '50%',
          transform: 'translate(-50%, 0)'
        }
      : {
          /* Внутри карточки, чтобы не обрезалось контейнером с overflow-x: hidden (галерея) */
          top: '6px',
          right: '6px'
        };

  const transformValue = isAnimating ? 'scale(1.18)' : 'scale(1)';

  return (
    <div
      data-testid="interactive-like-button"
      onClick={handleLikeClick}
      style={{
        position: 'absolute',
        ...positionStyles,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${visualIconSize}px`,
        height: `${visualIconSize}px`,
        zIndex: 10,
        transition: 'all 0.233s ease',
        pointerEvents: 'auto', // Делаем кликабельным!
        cursor: 'pointer',
        transform: placement === 'bottom-center'
          ? `${positionStyles.transform ?? ''} ${transformValue}`.trim()
          : transformValue,
        transformOrigin: 'center',
        filter: placement === 'bottom-center'
          ? `drop-shadow(0 4px 12px rgba(9, 14, 26, 0.55)) drop-shadow(0 18px 36px rgba(9, 14, 26, 0.62)) ${isAnimating ? 'brightness(1.18)' : 'brightness(1)'}`
          : isAnimating ? 'brightness(1.15)' : 'brightness(1)',
        boxShadow: 'none',
        background: 'transparent',
        overflow: 'visible'
      }}
      title={isLiked ? `${likesCount} лайков (нажмите чтобы убрать)` : `${likesCount} лайков (нажмите чтобы лайкнуть)`}
    >
      {/* Иконка на заднем слое */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) ${isAnimating ? 'rotate(15deg)' : 'rotate(0deg)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        transition: 'transform 0.233s ease',
        overflow: 'visible'
      }}>
        <LikeIcon
          size={heartIconSize}
          isLiked={isLiked}
        />
      </div>
      
      {/* Число лайков поверх иконки */}
      {showCount && (
        <span style={{
          position: 'relative',
          fontSize: currentSize.fontSize,
          color: placement === 'bottom-center'
            ? '#ffffff'
            : getTextColor(),
          fontWeight: '600',
          lineHeight: 1,
          textAlign: 'center',
          zIndex: 2,
          textShadow: placement === 'bottom-center'
            ? '0 3px 8px rgba(3, 7, 18, 0.75)'
            : isLiked 
              ? '0 1px 3px rgba(0, 0, 0, 0.4)'
              : '0 1px 3px rgba(0, 0, 0, 0.45)',
          transform: placement === 'bottom-center' ? 'translateY(0)' : 'translateY(-2px)',
          transition: 'color 0.233s ease',
          padding: placement === 'bottom-center' ? '0 2px' : 0
        }}>
          {likesCount}
        </span>
      )}

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

