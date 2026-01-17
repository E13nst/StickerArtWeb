import React, { useCallback, memo, useState, useEffect, useRef, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { AnimatedSticker } from './AnimatedSticker';
import { InteractiveLikeCount } from './InteractiveLikeCount';
import { imageCache, videoBlobCache, imageLoader, LoadPriority } from '../utils/imageLoader';
import { formatStickerTitle } from '../utils/stickerUtils';
import { useLikesStore } from '../store/useLikesStore';

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

interface PackCardProps {
  pack: Pack;
  onClick?: (packId: string) => void;
}

const PackCardComponent: React.FC<PackCardProps> = ({ 
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
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stickerShownAtRef = useRef<number>(Date.now());

  const isDimmed = pack.isBlocked || pack.isDeleted;
  const activeSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];
  
  // Форматируем заголовок один раз при изменении pack.title
  const formattedTitle = useMemo(() => {
    try {
      return formatStickerTitle(pack.title);
    } catch (error) {
      console.error('[FORMAT] Error formatting title:', error);
      return pack.title || '';
    }
  }, [pack.title]);

  // Получаем счетчик лайков
  const likesCount = useLikesStore((state) => {
    const likeState = state.likes[pack.id] || { packId: pack.id, isLiked: false, likesCount: 0 };
    return likeState.likesCount;
  });

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
      className="pack-card"
      onClick={handleClick}
      style={{
        width: '100%',
        aspectRatio: '177 / 213', // Соотношение из Figma
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'rgba(238, 68, 159, 0.2)', // Розовый фон с прозрачностью 20%
        border: 'none',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        touchAction: 'manipulation',
        opacity: isDimmed ? 0.5 : 1,
        filter: isDimmed ? 'grayscale(0.7)' : 'none',
        willChange: inView ? 'transform' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Заголовок сверху (из Figma) */}
      <div className="pack-card__header">
        <h3 className="pack-card__title">{formattedTitle}</h3>
      </div>

      {/* Превью стикера (161x161px из Figma) */}
      <div className="pack-card__preview">
        {!isFirstStickerReady ? (
          <div
            style={{
              width: '161px',
              height: '161px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              color: 'var(--tg-theme-hint-color)',
              backgroundColor: 'transparent',
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
                className="pack-card__preview-animated"
                hidePlaceholder={true}
                priority={inView ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_4_BACKGROUND}
              />
            ) : activeSticker.isVideo ? (
              <video
                ref={videoRef}
                src={videoBlobCache.get(activeSticker.fileId) || activeSticker.url}
                className="pack-card__preview-video"
                autoPlay={inView}
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={imageCache.get(activeSticker.fileId) || activeSticker.url}
                alt={activeSticker.emoji}
                className="pack-card__preview-image"
                loading="lazy"
              />
            )}
          </>
        ) : null}
      </div>

      {/* Счетчик лайков (из Figma - Group 11, Frame 71) */}
      <div className="pack-card__like-count">
        <span className="pack-card__like-count-text">{likesCount}</span>
      </div>
      
      {/* Иконка лайка для интерактивности (прозрачная, но кликабельна) */}
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '42px', height: '42px', zIndex: 4, opacity: 0.01 }}>
        <InteractiveLikeCount
          packId={pack.id}
          size="small"
          placement="top-right"
          showCount={false}
        />
      </div>

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

export const PackCard = memo(PackCardComponent, (prev, next) => {
  // Не сравниваем title, так как форматирование применяется при каждом рендере
  return prev.pack.id === next.pack.id && 
         prev.onClick === next.onClick;
});

