import { FC } from 'react';
import { FavoriteIcon } from '@/components/ui/Icons';

interface LikeCountProps {
  packId: string;
  likesCount: number;
  isLiked?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const LikeIcon: FC<{ 
  color: string; 
  size: number; 
  isLiked: boolean; 
}> = ({ color, size, isLiked }) => (
  <FavoriteIcon size={size} color={isLiked ? '#ff6b6b' : color} />
);

export const LikeCount: FC<LikeCountProps> = ({
  packId: _packId,
  likesCount,
  isLiked = false,
  size = 'medium'
}) => {
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
  
  const getThemeColor = () => '#ffffff';

  return (
    <div
      data-testid="like-button"
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
        pointerEvents: 'none',
        cursor: 'default'
      }}
      title={`${likesCount} лайков`}
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
        zIndex: 1
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
        color: getThemeColor(),
        fontWeight: '600',
        lineHeight: 1,
        textAlign: 'center',
        zIndex: 2,
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
        transform: 'translateY(-2px)'
      }}>
        {likesCount}
      </span>
    </div>
  );
};
