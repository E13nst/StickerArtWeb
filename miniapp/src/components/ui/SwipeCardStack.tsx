import { useCallback, useRef, useLayoutEffect, ReactNode, FC } from 'react';
import { motion, PanInfo, useMotionValue, useTransform, useMotionValueEvent, animate } from 'framer-motion';
import './SwipeCardStack.css';

export interface SwipeCard {
  id: string | number;
  [key: string]: any;
}

export interface SwipeCardActions {
  triggerSwipeLeft: () => void;
  triggerSwipeRight: () => void;
  /** Вызвать перед triggerSwipeRight при нажатии на кнопку like (для glow) */
  onBeforeLike?: () => void;
  /** Вызвать перед triggerSwipeLeft при нажатии на кнопку dislike (для glow) */
  onBeforeDislike?: () => void;
}

export interface SwipeCardStackProps {
  cards: SwipeCard[];
  onSwipeLeft: (card: SwipeCard) => void;
  onSwipeRight: (card: SwipeCard) => void | Promise<void>;
  onEnd: () => void;
  renderCard: (card: SwipeCard, index: number, actions?: SwipeCardActions) => ReactNode;
  maxVisibleCards?: number;
  swipeThreshold?: number;
  /** Индекс верхней карточки в глобальном списке родителя (для приоритетов загрузки и т.п.) */
  firstCardIndex?: number;
  /** Текущее смещение по Y при перетаскивании верхней карточки (для свечения по краям) */
  onDragY?: (y: number) => void;
  /** Тактильный отклик при пересечении порога во время свайпа (вверх/вниз) */
  onDragThresholdCrossed?: () => void;
  onBeforeLike?: () => void;
  onBeforeDislike?: () => void;
}

const DRAG_HAPTIC_THRESHOLD = 80;
const FLY_Y = 520;

export const SwipeCardStack: FC<SwipeCardStackProps> = ({
  cards,
  onSwipeLeft,
  onSwipeRight,
  onEnd: _onEnd,
  renderCard,
  maxVisibleCards = 4,
  swipeThreshold = 100,
  firstCardIndex = 0,
  onDragY,
  onDragThresholdCrossed,
  onBeforeLike,
  onBeforeDislike,
}) => {
  const thresholdCrossedRef = useRef(false);
  const swipeBusyRef = useRef(false);

  const y = useMotionValue(0);
  const topCardId = cards[0]?.id;

  useLayoutEffect(() => {
    y.set(0);
  }, [topCardId, y]);

  const opacity = useTransform(y, [-400, -80, 0, 80, 400], [0, 1, 1, 1, 0]);

  useMotionValueEvent(y, 'change', (latest) => {
    onDragY?.(latest);
    if (onDragThresholdCrossed && Math.abs(latest) >= DRAG_HAPTIC_THRESHOLD && !thresholdCrossedRef.current) {
      thresholdCrossedRef.current = true;
      onDragThresholdCrossed();
    }
  });

  const runSwipe = useCallback(
    async (direction: 'up' | 'down') => {
      if (swipeBusyRef.current || cards.length === 0) return;
      swipeBusyRef.current = true;
      const currentCard = cards[0];
      const targetY = direction === 'up' ? -FLY_Y : FLY_Y;
      try {
        await animate(y, targetY, { duration: 0.28, ease: [0.22, 1, 0.36, 1] });
        if (direction === 'down') {
          await Promise.resolve(onSwipeLeft(currentCard));
        } else {
          await Promise.resolve(onSwipeRight(currentCard));
        }
      } finally {
        swipeBusyRef.current = false;
      }
    },
    [cards, y, onSwipeLeft, onSwipeRight],
  );

  const triggerSwipeLeft = useCallback(() => void runSwipe('down'), [runSwipe]);
  const triggerSwipeRight = useCallback(() => void runSwipe('up'), [runSwipe]);

  const handleDragStart = useCallback(() => {
    thresholdCrossedRef.current = false;
  }, []);

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      void event;
      thresholdCrossedRef.current = false;
      if (swipeBusyRef.current) return;
      const swipeDistance = info.offset.y;
      const swipeVelocity = info.velocity.y;

      if (Math.abs(swipeDistance) > swipeThreshold || Math.abs(swipeVelocity) > 500) {
        const direction = swipeDistance < 0 ? 'up' : 'down';
        void runSwipe(direction);
      } else {
        void animate(y, 0, { type: 'spring', stiffness: 420, damping: 34 });
      }
    },
    [runSwipe, swipeThreshold, y],
  );

  const slice = cards.slice(0, maxVisibleCards);

  if (slice.length === 0) {
    return (
      <div className="swipe-card-stack swipe-card-stack--empty">
        <p className="swipe-card-stack__empty-message">No more cards</p>
      </div>
    );
  }

  return (
    <>
      <div className="swipe-card-stack">
        {slice.map((card, index) => {
          const isTopCard = index === 0;
          const cardIndex = firstCardIndex + index;

          if (isTopCard) {
            return (
              <motion.div
                key={String(card.id)}
                className="swipe-card-stack__card swipe-card-stack__card--top"
                style={{
                  y,
                  opacity,
                  zIndex: maxVisibleCards - index,
                }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={1}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                {renderCard(card, cardIndex, {
                  triggerSwipeLeft,
                  triggerSwipeRight,
                  onBeforeLike,
                  onBeforeDislike,
                })}
              </motion.div>
            );
          }

          const scaleX = 333 / 370;
          const scaleY = 470.7 / 523;
          return (
            <motion.div
              key={String(card.id)}
              className="swipe-card-stack__card swipe-card-stack__card--background"
              style={{
                zIndex: maxVisibleCards - index,
              }}
              initial={{ opacity: 0.95 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="swipe-card-stack__card-scaled"
                style={{
                  transform: `scale(${scaleX}, ${scaleY})`,
                  transformOrigin: '0 0',
                }}
              >
                {renderCard(card, cardIndex, undefined)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
};
