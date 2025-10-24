import React, { useCallback, memo, useState } from 'react';
import { useNearVisible } from '../hooks/useNearVisible';
import { useStickerRotation } from '../hooks/useStickerRotation';
import { AnimatedSticker } from './AnimatedSticker';
import { LikeButton } from './LikeButton';
import { useLikesStore } from '../store/useLikesStore';

interface Pack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    emoji: string;
  }>;
}

interface PackCardProps {
  pack: Pack;
  isFirstRow?: boolean;
  isHighPriority?: boolean; // Для первых 6 паков на экране
  onClick?: (packId: string) => void;
  onLikeAnimation?: (packId: string) => void;
}

const PackCardComponent: React.FC<PackCardProps> = ({ 
  pack, 
  isFirstRow = false,
  isHighPriority = false,
  onClick,
  onLikeAnimation
}) => {
  const { ref, isNear } = useNearVisible({ rootMargin: '800px' });
  const [isHovered, setIsHovered] = useState(false);
  const { getLikeState, toggleLike } = useLikesStore();

  // Используем хук для управления ротацией стикеров
  const { currentIndex: currentStickerIndex } = useStickerRotation({
    stickersCount: pack.previewStickers.length,
    autoRotateInterval: 3000, // 3 секунды
    hoverRotateInterval: 800,
    isHovered,
    isVisible: isNear
  });

  // Мемоизированный обработчик клика
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(pack.id);
    }
  }, [onClick, pack.id]);

  // Текущий стикер для отображения
  const currentSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];
  
  // Состояние лайка
  const likeState = getLikeState(pack.id);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="pack-card"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minHeight: '200px',
        height: '200px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: '0 2px 8px var(--tg-theme-shadow-color)',
        touchAction: 'manipulation',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
    >
      {/* Сменяющиеся превью стикеров */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {pack.previewStickers.map((sticker, index) => {
          const isActive = index === currentStickerIndex;
          const isNext = index === (currentStickerIndex + 1) % pack.previewStickers.length;
          
          return (
            <div
              key={`${pack.id}-${sticker.fileId}-${index}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scale(1)' : 'scale(0.95)',
                transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
                zIndex: isActive ? 2 : 1
              }}
            >
              {sticker.fileId ? (
                sticker.isAnimated ? (
                  <AnimatedSticker
                    fileId={sticker.fileId}
                    imageUrl={sticker.url}
                    emoji={sticker.emoji}
                    className="pack-card-animated-sticker"
                  />
                ) : (
                  <img
                    src={sticker.url}
                    alt={sticker.emoji}
                    className="pack-card-image"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    loading={isHighPriority ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                )
              ) : (
                <div 
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '48px',
                    color: 'var(--tg-theme-hint-color)'
                  }}
                >
                  {sticker.emoji}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Заголовок пака */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: `linear-gradient(transparent, var(--tg-theme-overlay-color))`,
          color: 'white',
          padding: '12px 8px 8px',
          fontSize: '14px',
          fontWeight: '500',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          zIndex: 3
        }}
      >
        {pack.title}
      </div>

      {/* Лайк и его статус */}
      <LikeButton
        packId={pack.id}
        initialLiked={likeState.isLiked}
        initialLikesCount={likeState.likesCount}
        size="medium"
        onLike={(packId, isLiked) => {
          toggleLike(packId);
          console.log(`Лайк для пака ${packId}: ${isLiked ? 'добавлен' : 'убран'}`);
          
          // Запускаем анимацию лайка
          if (isLiked && onLikeAnimation) {
            onLikeAnimation(packId);
          }
          
          // Здесь будет API вызов для сохранения лайка
        }}
      />
    </div>
  );
};

export const PackCard = memo(PackCardComponent);