import React, { useCallback, memo, useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { AnimatedSticker } from './AnimatedSticker';
import { InteractiveLikeCount } from './InteractiveLikeCount';
import { imageCache, videoBlobCache, imageLoader, LoadPriority } from '../utils/imageLoader';

interface Pack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    isVideo: boolean;
    emoji: string;
  }>;
  isPublic?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
}

interface OptimizedPackCardProps {
  pack: Pack;
  onClick?: (packId: string) => void;
}

const OptimizedPackCardComponent: React.FC<OptimizedPackCardProps> = ({ 
  pack, 
  onClick
}) => {
  // Используем react-intersection-observer для ленивой загрузки
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px', // Начинаем загрузку за 200px до появления
    triggerOnce: false, // Позволяет паузить видео при выходе из viewport
  });

  const [isFirstStickerReady, setIsFirstStickerReady] = useState(false);
  const [currentStickerIndex, setCurrentStickerIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stickerShownAtRef = useRef<number>(Date.now());

  const isDimmed = pack.isBlocked || pack.isDeleted;
  const activeSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];

  // Ленивая загрузка первого стикера только когда карточка видна
  useEffect(() => {
    if (!inView || !activeSticker || isFirstStickerReady) return;

    const priority = inView ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_4_BACKGROUND;
    
    const loadPromise = activeSticker.isVideo
      ? imageLoader.loadVideo(activeSticker.fileId, activeSticker.url, priority)
      : activeSticker.isAnimated
        ? imageLoader.loadAnimation(activeSticker.fileId, activeSticker.url, priority)
        : imageLoader.loadImage(activeSticker.fileId, activeSticker.url, priority);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    Promise.race([loadPromise, timeoutPromise])
      .then(() => setIsFirstStickerReady(true))
      .catch(() => setIsFirstStickerReady(true)); // Показываем даже при ошибке
  }, [inView, activeSticker, isFirstStickerReady]);

  // Упрощенная ротация стикеров только для видимых карточек
  useEffect(() => {
    if (!inView || pack.previewStickers.length <= 1) {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
        rotationTimerRef.current = null;
      }
      return;
    }

    // Проверяем, прошло ли минимальное время показа (2 секунды)
    const checkAndRotate = () => {
      const timeShown = Date.now() - stickerShownAtRef.current;
      if (timeShown >= 2000) {
        setCurrentStickerIndex(prev => {
          const nextIndex = (prev + 1) % pack.previewStickers.length;
          stickerShownAtRef.current = Date.now();
          return nextIndex;
        });
      }
    };

    rotationTimerRef.current = setInterval(checkAndRotate, 500); // Проверяем каждые 500ms

    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    };
  }, [inView, pack.previewStickers.length]);

  // Обновляем время показа при изменении индекса
  useEffect(() => {
    stickerShownAtRef.current = Date.now();
  }, [currentStickerIndex]);

  // Пауза видео при выходе из viewport
  useEffect(() => {
    if (!videoRef.current || !activeSticker?.isVideo) return;

    if (inView) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [inView, activeSticker?.isVideo]);

  const handleClick = useCallback(() => {
    onClick?.(pack.id);
  }, [onClick, pack.id]);

  return (
    <div
      ref={ref}
      data-testid="pack-card"
      className="optimized-pack-card"
      onClick={handleClick}
      style={{
        width: '100%',
        aspectRatio: '1 / 1.618',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: '0 2px 8px var(--tg-theme-shadow-color)',
        touchAction: 'manipulation',
        opacity: isDimmed ? 0.5 : 1,
        filter: isDimmed ? 'grayscale(0.7)' : 'none',
        willChange: inView ? 'transform' : 'auto',
      }}
    >
      {/* Контент стикера */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isFirstStickerReady ? (
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
            }}
          >
            {activeSticker?.emoji || '🎨'}
          </div>
        ) : activeSticker ? (
          <>
            {activeSticker.isAnimated ? (
              <AnimatedSticker
                fileId={activeSticker.fileId}
                imageUrl={activeSticker.url}
                emoji={activeSticker.emoji}
                className="pack-card-animated-sticker"
                hidePlaceholder={true}
                priority={inView ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_4_BACKGROUND}
              />
            ) : activeSticker.isVideo ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <video
                  ref={videoRef}
                  src={videoBlobCache.get(activeSticker.fileId) || activeSticker.url}
                  className="pack-card-video"
                  autoPlay={inView}
                  loop
                  muted
                  playsInline
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={imageCache.get(activeSticker.fileId) || activeSticker.url}
                  alt={activeSticker.emoji}
                  className="pack-card-image"
                  loading="lazy"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Заголовок */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, var(--tg-theme-overlay-color))',
          color: 'white',
          padding: '12px 8px 8px',
          fontSize: '13px',
          fontWeight: '500',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {pack.title}
      </div>

      {/* Лайк */}
      <InteractiveLikeCount
        packId={pack.id}
        size="medium"
        placement="top-right"
      />

      {/* Бейдж статуса */}
      {isDimmed && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: 'rgba(244, 67, 54, 0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            zIndex: 10
          }}
        >
          {pack.isDeleted ? '❌ Удален' : '🚫 Заблокирован'}
        </div>
      )}
    </div>
  );
};

export const OptimizedPackCard = memo(OptimizedPackCardComponent, (prev, next) => {
  return prev.pack.id === next.pack.id && 
         prev.pack.title === next.pack.title &&
         prev.onClick === next.onClick;
});

