import { useRef, useState, useCallback, useMemo, useEffect, CSSProperties, FC } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { useTelegram } from '@/hooks/useTelegram';
import { AnimatedSticker } from './AnimatedSticker';
import { FavoriteIcon } from '@/components/ui/Icons';
import { StickerSetResponse } from '@/types/sticker';
import { imageCache, videoBlobCache, LoadPriority } from '@/utils/imageLoader';
import { getStickerImageUrl, getStickerVideoUrl, getStickerVideoUrlHevc, formatStickerTitle } from '@/utils/stickerUtils';
import { TransparentVideo } from '@/components/ui/TransparentVideo';
import { useStickerLoadQueue } from '@/hooks/useStickerLoadQueue';

interface SwipeCardProps {
  stickerSet: StickerSetResponse;
  onSwipeLeft: () => void;  // Свайп вниз = дизлайк
  onSwipeRight: () => void; // Свайп вверх = лайк
  onTap?: () => void;       // Опциональный тап по центру (для обратной совместимости)
  isTopCard: boolean;
  style?: CSSProperties;
  priority?: LoadPriority;
}

const SWIPE_THRESHOLD = 150; // px для завершения вертикального свайпа
const ROTATION_FACTOR = 10; // градусов на 100px вертикального смещения
const TAP_ZONE_WIDTH = 0.3; // 30% ширины для зон тапа (левый/правый край)

export const SwipeCard: FC<SwipeCardProps> = ({
  stickerSet,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  isTopCard,
  style,
  priority = LoadPriority.TIER_2_NEAR_VIEWPORT
}) => {
  const { tg } = useTelegram();
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeStickerIndex, setActiveStickerIndex] = useState(0);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Получаем все стикеры из набора
  const stickers = useMemo(() => {
    return stickerSet.telegramStickerSetInfo?.stickers || [];
  }, [stickerSet]);

  // Инициализация очереди загрузки
  const { isLoaded, triggerLoad, clearQueue } = useStickerLoadQueue({
    stickers,
    packId: stickerSet.id.toString(),
    initialLoad: 5,
    loadOnScroll: 2,
    enabled: isTopCard
  });

  // Motion values для отслеживания вертикального положения
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Вычисляемые значения на основе вертикального смещения (y)
  // Вращение при вертикальном свайпе (меньше, чем при горизонтальном)
  const rotate = useTransform(y, [-200, 0, 200], [-ROTATION_FACTOR, 0, ROTATION_FACTOR]);
  
  // Интенсивность свечения (усиливается по мере вертикального свайпа)
  const glowIntensity = useTransform(
    y,
    [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    [1, 0, 1]
  );

  // Цвет свечения: розовый для лайка (вверх, y < 0), красный для дизлайка (вниз, y > 0)
  const glowColor = useTransform(y, (value) => {
    const intensity = Math.min(Math.abs(value) / SWIPE_THRESHOLD, 1);
    if (value < 0) {
      // Свайп вверх = лайк = розовый
      return `rgba(255, 105, 180, ${intensity})`;
    } else if (value > 0) {
      // Свайп вниз = дизлайк = красный
      return `rgba(255, 50, 50, ${intensity})`;
    }
    return 'rgba(255, 255, 255, 0)';
  });

  // Box shadow — свечение во время свайпа (меньший размер, в viewport)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boxShadow = (useTransform as any)(
    [glowIntensity, glowColor, y],
    ([intensity, color, yValue]: [number, string, number]) => {
      const i = intensity;
      const c = color;
      const y = yValue;
      
      if (y > 0) {
        return `0 0 ${i * 24}px ${i * 10}px ${c}, inset 0 0 ${i * 16}px rgba(0, 0, 0, ${i * 0.8})`;
      } else {
        return `0 0 ${i * 24}px ${i * 10}px ${c}`;
      }
    }
  );

  // Фоновый градиент для эффекта сжигания (при свайпе вниз)
  const burnGradientOpacity = useTransform(y, (value) => {
    if (value <= 0) return 0;
    return Math.min(value / SWIPE_THRESHOLD, 1) * 0.3;
  });

  /**
   * Обработка завершения вертикального перетаскивания
   */
  const handleDragEnd = useCallback(
    (_event: any, info: PanInfo) => {
      setIsDragging(false);
      const { offset, velocity } = info;
      // ВЕРТИКАЛЬНЫЙ свайп: проверяем offset.y и velocity.y
      const swipe = Math.abs(offset.y) > SWIPE_THRESHOLD || Math.abs(velocity.y) > 500;

      if (swipe) {
        // offset.y < 0 = свайп вверх = лайк
        // offset.y > 0 = свайп вниз = дизлайк
        const direction = offset.y < 0 ? 'up' : 'down';
        
        // Вибрация при свайпе
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.impactOccurred('medium');
        }

        // Очищаем очередь загрузки при свайпе
        clearQueue();

        // Анимация исчезновения перед вызовом обработчика
        if (direction === 'up') {
          // Лайк вверх: улетает вверх-вправо
          y.set(-1000);
          x.set(500);
        } else {
          // Дизлайк вниз: улетает вниз-влево
          y.set(1000);
          x.set(-500);
        }

        // Небольшая задержка для анимации перед вызовом обработчика
        setTimeout(() => {
          if (direction === 'up') {
            onSwipeRight(); // Лайк = onSwipeRight
          } else {
            onSwipeLeft(); // Дизлайк = onSwipeLeft
          }
          // Сброс позиции для следующей карточки
          x.set(0);
          y.set(0);
        }, 200);
      } else {
        // Возврат в исходное положение
        x.set(0);
        y.set(0);
      }
    },
    [onSwipeLeft, onSwipeRight, tg, x, y, clearQueue]
  );

  /**
   * Обработка тапа для навигации между стикерами
   * Левый край (30%) = предыдущий стикер
   * Правый край (30%) или центр = следующий стикер
   */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTopCard || !previewRef.current) return;
    tapStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    };
  }, [isTopCard]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isTopCard || !tapStartRef.current || !previewRef.current || isDragging) {
      tapStartRef.current = null;
      return;
    }

    const deltaX = Math.abs(e.clientX - tapStartRef.current.x);
    const deltaY = Math.abs(e.clientY - tapStartRef.current.y);
    const deltaTime = Date.now() - tapStartRef.current.time;

    // Это тап, если движение < 10px и время < 300ms
    if (deltaX < 10 && deltaY < 10 && deltaTime < 300 && stickers.length > 1) {
      const rect = previewRef.current.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const relativeX = tapX / rect.width;

      // Определяем зону тапа
      if (relativeX < TAP_ZONE_WIDTH) {
        // Левый край: предыдущий стикер (только если загружен)
        let prevIndex = activeStickerIndex;
        for (let i = 1; i <= stickers.length; i++) {
          const candidateIndex = (activeStickerIndex - i + stickers.length) % stickers.length;
          if (isLoaded(candidateIndex)) {
            prevIndex = candidateIndex;
            break;
          }
        }
        if (prevIndex !== activeStickerIndex) {
          setActiveStickerIndex(prevIndex);
          triggerLoad(); // Догружаем дополнительные стикеры
          if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
          }
        }
      } else {
        // Правый край или центр: следующий стикер (только если загружен)
        let nextIndex = activeStickerIndex;
        for (let i = 1; i <= stickers.length; i++) {
          const candidateIndex = (activeStickerIndex + i) % stickers.length;
          if (isLoaded(candidateIndex)) {
            nextIndex = candidateIndex;
            break;
          }
        }
        if (nextIndex !== activeStickerIndex) {
          setActiveStickerIndex(nextIndex);
          triggerLoad(); // Догружаем дополнительные стикеры
          if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
          }
        } else if (onTap) {
          // Если следующий не загружен и есть onTap (для обратной совместимости)
          onTap();
        }
      }
    }

    tapStartRef.current = null;
  }, [isDragging, isTopCard, stickers.length, activeStickerIndex, isLoaded, triggerLoad, tg, onTap]);

  // Получаем текущий активный стикер для превью
  const currentSticker = useMemo(() => {
    return stickers[activeStickerIndex] || stickers[0];
  }, [stickers, activeStickerIndex]);

  const isAnimated = currentSticker?.is_animated || stickerSet.telegramStickerSetInfo?.is_animated || false;
  const isVideo = currentSticker?.is_video || stickerSet.telegramStickerSetInfo?.is_video || false;

  // Формируем категории
  const categories = stickerSet.categories?.slice(0, 3) || [];
  const likesCount = stickerSet.likesCount || 0;

  // Сбрасываем индекс при смене карточки
  useEffect(() => {
    if (!isTopCard) {
      setActiveStickerIndex(0);
    }
  }, [isTopCard, stickerSet.id]);

  useEffect(() => {
    if (!videoRef.current || !isVideo) return;
    if (isTopCard) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isTopCard, isVideo]);

  return (
    <motion.div
      ref={cardRef}
      drag={isTopCard ? 'y' : false} // ВЕРТИКАЛЬНЫЙ свайп
      dragConstraints={{ top: -300, bottom: 300 }}
      dragElastic={0.7}
      dragMomentum={false}
      onDragStart={() => {
        setIsDragging(true);
      }}
      onDrag={(_, info) => {
        y.set(info.offset.y);
        x.set(info.offset.y * 0.1 * (info.offset.y > 0 ? -1 : 1));
      }}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        x,
        y,
        rotate,
        boxShadow,
        touchAction: 'none',
        userSelect: 'none',
        cursor: isTopCard ? 'grab' : 'default',
        ...style,
      }}
      animate={!isDragging ? { x: 0, y: 0, rotate: 0 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="swipe-card"
    >
      {/* Контейнер превью стикера с зонами тапа */}
      <div 
        ref={previewRef}
        className="swipe-card__preview"
        style={{ position: 'relative' }}
      >
        {currentSticker ? (
          <>
            {isAnimated ? (
              <AnimatedSticker
                fileId={currentSticker.file_id}
                imageUrl={getStickerImageUrl(currentSticker.file_id)}
                emoji={currentSticker.emoji || '🎨'}
                className="pack-card-animated-sticker"
                priority={isTopCard ? LoadPriority.TIER_1_VIEWPORT : priority}
                hidePlaceholder={false}
              />
            ) : isVideo ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent'
                }}
              >
                <TransparentVideo
                  ref={videoRef}
                  webmSrc={currentSticker.url || getStickerVideoUrl(currentSticker.file_id)}
                  hevcUrl={getStickerVideoUrlHevc(currentSticker.file_id) || undefined}
                  className="pack-card-video"
                  autoPlay={isTopCard}
                  loop
                  muted
                  playsInline
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    backgroundColor: 'transparent'
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
                  src={imageCache.get(currentSticker.file_id) || getStickerImageUrl(currentSticker.file_id)}
                  alt={currentSticker.emoji || formatStickerTitle(stickerSet.title)}
                  className="pack-card-image"
                  loading={isTopCard ? 'eager' : 'lazy'}
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
          <div className="swipe-card__placeholder">
            <span className="swipe-card__placeholder-emoji">🎨</span>
          </div>
        )}
        
        {/* Индикатор позиции стикера */}
        {stickers.length > 1 && (
          <div className="swipe-card__position-indicator">
            {activeStickerIndex + 1} / {stickers.length}
          </div>
        )}
        
        {/* Эффект "сжигания" при свайпе вниз (красный градиент) */}
        <motion.div
          className="swipe-card__burn-overlay"
          style={{
            opacity: burnGradientOpacity,
          }}
        />
      </div>

      {/* Информация о стикерсете */}
      <div className="swipe-card__info">
        <h2 className="swipe-card__title">{formatStickerTitle(stickerSet.title)}</h2>
        <p className="swipe-card__name">@{stickerSet.name}</p>

        {/* Категории */}
        {categories.length > 0 && (
          <div className="swipe-card__categories">
            {categories.map(category => (
              <span key={category.key} className="swipe-card__category">
                {category.name}
              </span>
            ))}
          </div>
        )}

        {/* Счетчик лайков */}
        <div className="swipe-card__likes">
          <span className="swipe-card__likes-icon"><FavoriteIcon size={14} color="#ff6b6b" /></span>
          <span className="swipe-card__likes-count">{likesCount}</span>
        </div>
      </div>
    </motion.div>
  );
};
