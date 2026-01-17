import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { useTelegram } from '@/hooks/useTelegram';
import { useGlassEffect } from '@/hooks/useGlassEffect';
import { AnimatedSticker } from './AnimatedSticker';
import { StickerSetResponse } from '@/types/sticker';
import { LoadPriority } from '@/utils/imageLoader';
import { getStickerImageUrl } from '@/utils/stickerUtils';
import { useStickerLoadQueue } from '@/hooks/useStickerLoadQueue';
import { StickerThumbnail } from './StickerThumbnail';

interface SwipeCardProps {
  stickerSet: StickerSetResponse;
  onSwipeLeft: () => void;  // Свайп вниз = дизлайк
  onSwipeRight: () => void; // Свайп вверх = лайк
  onTap?: () => void;       // Опциональный тап по центру (для обратной совместимости)
  isTopCard: boolean;
  style?: React.CSSProperties;
  priority?: LoadPriority;
}

const SWIPE_THRESHOLD = 150; // px для завершения вертикального свайпа
const ROTATION_FACTOR = 10; // градусов на 100px вертикального смещения
const TAP_ZONE_WIDTH = 0.3; // 30% ширины для зон тапа (левый/правый край)

export const SwipeCard: React.FC<SwipeCardProps> = ({
  stickerSet,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  isTopCard,
  style,
  priority = LoadPriority.TIER_2_NEAR_VIEWPORT
}) => {
  const { tg } = useTelegram();
  const glassEffect = useGlassEffect();
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeStickerIndex, setActiveStickerIndex] = useState(0);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Получаем все стикеры из набора
  const stickers = useMemo(() => {
    return stickerSet.telegramStickerSetInfo?.stickers || [];
  }, [stickerSet]);

  // Инициализация очереди загрузки
  // Для передней карточки используем максимальный приоритет, для остальных - переданный
  const cardPriority = isTopCard ? LoadPriority.TIER_1_VIEWPORT : priority;
  const { isLoaded, triggerLoad, clearQueue } = useStickerLoadQueue({
    stickers,
    packId: stickerSet.id.toString(),
    initialLoad: 5,
    loadOnScroll: 2,
    enabled: isTopCard,
    basePriority: cardPriority
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

  // Box shadow с эффектом "сжигания" для дизлайка (вниз)
  const boxShadow = useTransform(
    [glowIntensity, glowColor, y],
    ([intensity, color, yValue]) => {
      const i = intensity as number;
      const c = color as string;
      const y = yValue as number;
      
      if (y > 0) {
        // Дизлайк вниз: красное свечение + чёрная внутренняя тень (эффект сжигания)
        return `0 0 ${i * 50}px ${i * 20}px ${c}, inset 0 0 ${i * 30}px rgba(0, 0, 0, ${i * 0.8})`;
      } else {
        // Лайк вверх: розовое свечение
        return `0 0 ${i * 40}px ${i * 15}px ${c}`;
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
      const tapY = e.clientY - rect.top;
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
  const thumbnailsScrollRef = useRef<HTMLDivElement>(null);

  // Обработчик клика по мини-превью для переключения стикера
  const handleThumbnailClick = useCallback((index: number) => {
    if (isTopCard && isLoaded(index)) {
      setActiveStickerIndex(index);
      triggerLoad();
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    }
  }, [isTopCard, isLoaded, triggerLoad, tg]);

  // Прокрутка к активному мини-превью
  useEffect(() => {
    if (thumbnailsScrollRef.current && isTopCard) {
      const activeThumbnail = thumbnailsScrollRef.current.querySelector(
        `[data-thumbnail-index="${activeStickerIndex}"]`
      );
      if (activeThumbnail) {
        activeThumbnail.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest'
        });
      }
    }
  }, [activeStickerIndex, isTopCard]);

  // Сбрасываем индекс при смене карточки
  useEffect(() => {
    if (!isTopCard) {
      setActiveStickerIndex(0);
    }
  }, [isTopCard, stickerSet.id]);

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
        // Небольшое горизонтальное смещение при вертикальном свайпе для эффекта
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
        background: glassEffect.glassBase,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: `1px solid ${glassEffect.borderColor}`,
        ...style,
      }}
      animate={!isDragging ? { x: 0, y: 0, rotate: 0 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="swipe-card"
    >
      {/* Заголовок и подзаголовок (вверху карточки) */}
      <div className="swipe-card__header">
        <h2 className="swipe-card__title">{stickerSet.title}</h2>
        {(() => {
          // Определяем имя автора: username или firstName + lastName
          const authorName = stickerSet.username 
            ? `@${stickerSet.username}`
            : [stickerSet.firstName, stickerSet.lastName].filter(Boolean).join(' ').trim();
          
          return authorName ? (
            <p className="swipe-card__name">{authorName}</p>
          ) : null;
        })()}
      </div>

      {/* Контейнер превью стикера с зонами тапа */}
      <div 
        ref={previewRef}
        className="swipe-card__preview"
        style={{ position: 'relative' }}
      >
        {currentSticker ? (
          isAnimated || isVideo ? (
            <AnimatedSticker
              fileId={currentSticker.file_id}
              imageUrl={getStickerImageUrl(currentSticker.file_id)}
              emoji={currentSticker.emoji || '🎨'}
              className="swipe-card__sticker"
              priority={isTopCard ? LoadPriority.TIER_1_VIEWPORT : priority}
              hidePlaceholder={false}
            />
          ) : (
            <img
              src={getStickerImageUrl(currentSticker.file_id)}
              alt={currentSticker.emoji || stickerSet.title}
              className="swipe-card__sticker"
              loading={isTopCard ? 'eager' : 'lazy'}
            />
          )
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

      {/* Горизонтальная прокрутка мини-превью стикеров */}
      {stickers.length > 0 && (
        <div className="swipe-card__thumbnails-container">
          <div 
            ref={thumbnailsScrollRef}
            className="swipe-card__thumbnails-scroll"
          >
            {stickers.map((sticker, index) => {
              const isActive = index === activeStickerIndex;
              return (
                <div
                  key={sticker.file_id}
                  data-thumbnail-index={index}
                  className={`swipe-card__thumbnail ${isActive ? 'swipe-card__thumbnail--active' : ''}`}
                  onClick={() => handleThumbnailClick(index)}
                >
                  <StickerThumbnail
                    fileId={sticker.file_id}
                    thumbFileId={sticker.thumb?.file_id}
                    emoji={sticker.emoji}
                    size={80}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

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
    </motion.div>
  );
};
