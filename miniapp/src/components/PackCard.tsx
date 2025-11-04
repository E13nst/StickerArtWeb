import React, { useCallback, memo, useState, useEffect } from 'react';
import { useNearVisible } from '../hooks/useNearVisible';
import { useStickerRotation } from '../hooks/useStickerRotation';
import { AnimatedSticker } from './AnimatedSticker';
import { InteractiveLikeCount } from './InteractiveLikeCount';
import { imageLoader } from '../utils/imageLoader';
import { prefetchAnimation, markAsGalleryAnimation } from '../utils/animationLoader';
import { LoadPriority } from '../utils/imageLoader';

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
}

const PackCardComponent: React.FC<PackCardProps> = ({ 
  pack, 
  isFirstRow = false,
  isHighPriority = false,
  onClick
}) => {
  const { ref, isNear } = useNearVisible({ rootMargin: '800px' });
  const [isHovered, setIsHovered] = useState(false);
  const [isFirstStickerReady, setIsFirstStickerReady] = useState(false);

  // Предзагрузка первого стикера фоном для всех карточек
  useEffect(() => {
    if (pack.previewStickers.length > 0) {
      const firstSticker = pack.previewStickers[0];
      const priority = isHighPriority ? LoadPriority.TIER_1_FIRST_6_PACKS : LoadPriority.TIER_2_FIRST_IMAGE;
      
      // Загружаем изображение и JSON если анимация
      imageLoader.loadImage(firstSticker.fileId, firstSticker.url, priority)
        .then(() => {
          console.log(`✅ First sticker ready for pack ${pack.id}`);
          setIsFirstStickerReady(true);
          
          // Prefetch JSON для анимаций
          if (firstSticker.isAnimated) {
            prefetchAnimation(firstSticker.fileId, firstSticker.url).then(() => {
              markAsGalleryAnimation(firstSticker.fileId);
            }).catch(() => {});
          }
        })
        .catch(() => {
          console.warn(`⚠️ Failed to load first sticker for pack ${pack.id}`);
          setIsFirstStickerReady(true); // Показываем даже если ошибка
        });
    }
  }, [pack.id, pack.previewStickers, isHighPriority]);

  // Предзагрузка остальных стикеров фоном только когда карточка рядом с viewport
  useEffect(() => {
    if (pack.previewStickers.length > 0 && isNear) {
      for (let i = 1; i < pack.previewStickers.length; i++) {
        const sticker = pack.previewStickers[i];
        imageLoader.loadImage(sticker.fileId, sticker.url, LoadPriority.TIER_4_BACKGROUND)
          .then(() => {
            // Prefetch JSON для анимаций
            if (sticker.isAnimated) {
              prefetchAnimation(sticker.fileId, sticker.url).then(() => {
                markAsGalleryAnimation(sticker.fileId);
              }).catch(() => {});
            }
          })
          .catch(() => {}); // Игнорируем ошибки для фоновых стикеров
      }
    }
  }, [pack.id, pack.previewStickers, isNear]);

  // Используем хук для управления ротацией стикеров
  const { currentIndex: currentStickerIndex } = useStickerRotation({
    stickersCount: pack.previewStickers.length,
    autoRotateInterval: 2333,
    hoverRotateInterval: 618,
    isHovered,
    isVisible: isNear,
    stickerSources: pack.previewStickers.map(s => ({ fileId: s.fileId, url: s.url, isAnimated: s.isAnimated })),
    minDisplayDuration: 2000
  });

  // useStickerRotation гарантирует готовность стикера перед переключением индекса
  // Поэтому мы можем напрямую использовать currentStickerIndex без дополнительных проверок

  // Мемоизированный обработчик клика
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(pack.id);
    }
  }, [onClick, pack.id]);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="pack-card"
      data-testid="pack-card"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        aspectRatio: '1 / 1.618', // Золотое сечение (φ = 1.618)
        borderRadius: '13px', // Число Фибоначчи
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: '0 3px 13px var(--tg-theme-shadow-color)', // 3 и 13 - числа Фибоначчи
        touchAction: 'manipulation',
        transition: 'transform 0.233s ease, box-shadow 0.233s ease' // 0.233 ≈ 1/φ
      }}
    >
      {/* Сменяющиеся превью стикеров - ОПТИМИЗИРОВАНО: рендерим только активный */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isFirstStickerReady ? (
          // Skeleton loader пока первый стикер загружается
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              color: 'var(--tg-theme-hint-color)',
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}
          >
            {pack.previewStickers[0]?.emoji || '🎨'}
          </div>
        ) : (() => {
          const activeSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];
          if (!activeSticker) return null;
          
          // useStickerRotation гарантирует готовность перед переключением
          // Поэтому показываем стикер сразу по currentStickerIndex
          return (
            <div
              key={`${pack.id}-${activeSticker.fileId}-${currentStickerIndex}`}
              data-testid="sticker-preview"
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                opacity: 1
              }}
            >
              {activeSticker.isAnimated ? (
                <AnimatedSticker
                  fileId={activeSticker.fileId}
                  imageUrl={activeSticker.url}
                  emoji={activeSticker.emoji}
                  className="pack-card-animated-sticker"
                  hidePlaceholder={true}
                />
              ) : (
                <img
                  src={activeSticker.url}
                  alt={activeSticker.emoji}
                  className="pack-card-image"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              )}
            </div>
          );
        })()}
      </div>
      
      {/* Заголовок пака */}
      <div
        data-testid="pack-title"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: `linear-gradient(transparent, var(--tg-theme-overlay-color))`,
          color: 'white',
          padding: '13px 8px 8px', // 13 - число Фибоначчи
          fontSize: '13px', // Число Фибоначчи
          fontWeight: '500',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          zIndex: 3,
          lineHeight: '1.618' // Золотое сечение для межстрочного интервала
        }}
      >
        {pack.title}
      </div>

      {/* Интерактивный лайк */}
      <InteractiveLikeCount
        packId={pack.id}
        size="medium"
      />
    </div>
  );
};

export const PackCard = memo(PackCardComponent);