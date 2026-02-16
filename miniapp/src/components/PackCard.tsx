import { useCallback, memo, useState, useEffect, useRef, useMemo, FC } from 'react';
import { useInView } from 'react-intersection-observer';
import { AnimatedSticker } from './AnimatedSticker';
import { InteractiveLikeCount } from './InteractiveLikeCount';
import { imageCache, videoBlobCache, LoadPriority } from '../utils/imageLoader';
import { formatStickerTitle } from '../utils/stickerUtils';
import './PackCard.css';

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
  /** Компактный лайк (например в dashboard-card) — тот же цвет, меньший размер */
  likeSize?: 'small' | 'medium' | 'large';
}

const PackCardComponent: FC<PackCardProps> = ({ 
  pack, 
  onClick,
  likeSize = 'medium'
}) => {
  // Используем react-intersection-observer для ленивой загрузки
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px', // Начинаем загрузку за 200px до появления
    triggerOnce: false, // Позволяет паузить видео при выходе из viewport
  });

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
    if (!videoRef.current || !(activeSticker?.isVideo ?? (activeSticker as any).is_video)) return;

    if (inView) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [inView, activeSticker?.isVideo ?? (activeSticker as any).is_video]);

  const handleClick = useCallback(() => {
    onClick?.(pack.id);
  }, [onClick, pack.id]);

  return (
    <div
      ref={ref}
      data-testid="pack-card"
      className={`pack-card ${isDimmed ? 'pack-card--dimmed' : ''}`}
      onClick={handleClick}
      style={{ willChange: inView ? 'transform' : 'auto' }}
    >
      {/* Контент стикера — показываем сразу, как на Dashboard (AnimatedSticker/img грузят сами) */}
      <div className="pack-card__content">
        {activeSticker ? (
          <>
            {(activeSticker.isAnimated ?? (activeSticker as any).is_animated) ? (
              <AnimatedSticker
                fileId={activeSticker.fileId}
                imageUrl={activeSticker.url}
                emoji={activeSticker.emoji}
                className="pack-card-animated-sticker"
                hidePlaceholder={true}
                priority={inView ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_4_BACKGROUND}
              />
            ) : (activeSticker.isVideo ?? (activeSticker as any).is_video) ? (
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
        ) : (
          <div className="pack-card__placeholder">
            {(activeSticker as { emoji?: string })?.emoji || '🎨'}
          </div>
        )}
      </div>

      {/* Заголовок */}
      <div className="pack-card__title-overlay">
        {formattedTitle}
      </div>

      {/* Лайк — тот же стиль (активный #ee449f), размер через likeSize */}
      <InteractiveLikeCount
        packId={pack.id}
        size={likeSize}
        placement="top-right"
      />

      {/* Бейдж статуса */}
      {isDimmed && (
        <div className="pack-card__badge-status">
          {pack.isDeleted ? '❌ Удален' : '🚫 Заблокирован'}
        </div>
      )}
    </div>
  );
};

export const PackCard = memo(PackCardComponent, (prev, next) => {
  // Не сравниваем title, так как форматирование применяется при каждом рендере
  return prev.pack.id === next.pack.id && 
         prev.onClick === next.onClick &&
         prev.likeSize === next.likeSize;
});

