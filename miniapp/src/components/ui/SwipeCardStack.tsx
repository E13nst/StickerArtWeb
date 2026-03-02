import { useState, useCallback, ReactNode, FC } from 'react';
import { motion, PanInfo, useMotionValue, useTransform, useMotionValueEvent } from 'framer-motion';
import './SwipeCardStack.css';

export interface SwipeCard {
  id: string | number;
  [key: string]: any;
}

export interface SwipeCardActions {
  triggerSwipeLeft: () => void;
  triggerSwipeRight: () => void;
}

export interface SwipeCardStackProps {
  cards: SwipeCard[];
  onSwipeLeft: (card: SwipeCard) => void;
  onSwipeRight: (card: SwipeCard) => void;
  onEnd: () => void;
  renderCard: (card: SwipeCard, index: number, actions?: SwipeCardActions) => ReactNode;
  maxVisibleCards?: number;
  swipeThreshold?: number;
  /** Текущее смещение по Y при перетаскивании верхней карточки (для свечения по краям) */
  onDragY?: (y: number) => void;
}

export const SwipeCardStack: FC<SwipeCardStackProps> = ({
  cards,
  onSwipeLeft,
  onSwipeRight,
  onEnd,
  renderCard,
  maxVisibleCards = 4,
  swipeThreshold = 100,
  onDragY,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<'up' | 'down' | null>(null);

  const y = useMotionValue(0);
  const opacity = useTransform(y, [-200, -80, 0, 80, 200], [0, 1, 1, 1, 0]);

  useMotionValueEvent(y, 'change', (latest) => {
    onDragY?.(latest);
  });

  const runSwipe = useCallback(
    (direction: 'up' | 'down') => {
      const currentCard = cards[currentIndex];
      setExitDirection(direction);
      if (direction === 'down') {
        onSwipeLeft(currentCard);
      } else {
        onSwipeRight(currentCard);
      }
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        setExitDirection(null);
        y.set(0);
        if (currentIndex + 1 >= cards.length) {
          onEnd();
        }
      }, 300);
    },
    [cards, currentIndex, onSwipeLeft, onSwipeRight, onEnd, y]
  );

  const triggerSwipeLeft = useCallback(() => runSwipe('down'), [runSwipe]);
  const triggerSwipeRight = useCallback(() => runSwipe('up'), [runSwipe]);

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      void event;
      const swipeDistance = info.offset.y;
      const swipeVelocity = info.velocity.y;

      if (Math.abs(swipeDistance) > swipeThreshold || Math.abs(swipeVelocity) > 500) {
        const direction = swipeDistance < 0 ? 'up' : 'down';
        runSwipe(direction);
      } else {
        y.set(0);
      }
    },
    [runSwipe, swipeThreshold, y]
  );

  // Calculate visible cards
  const visibleCards = cards.slice(currentIndex, currentIndex + maxVisibleCards);

  if (currentIndex >= cards.length) {
    return (
      <div className="swipe-card-stack swipe-card-stack--empty">
        <p className="swipe-card-stack__empty-message">No more cards</p>
      </div>
    );
  }

  return (
    <>
      <div className="swipe-card-stack">
        {visibleCards.map((card, index) => {
          const isTopCard = index === 0;
          const cardIndex = currentIndex + index;

          if (isTopCard) {
            return (
              <motion.div
                key={`${card.id}-${cardIndex}`}
                className="swipe-card-stack__card swipe-card-stack__card--top"
                style={{
                  y: exitDirection ? undefined : y,
                  opacity: exitDirection ? undefined : opacity,
                  zIndex: maxVisibleCards - index,
                }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={1}
                onDragEnd={handleDragEnd}
                animate={
                  exitDirection
                    ? {
                        y: exitDirection === 'up' ? -400 : 400,
                        opacity: 0,
                      }
                    : {}
                }
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {renderCard(card, cardIndex, { triggerSwipeLeft, triggerSwipeRight })}
              </motion.div>
            );
          }

          // Background cards (Figma: second 333×470.7 at 18.5px, 67.15px) — контент 370×523 масштабируется
          const scaleX = 333 / 370;
          const scaleY = 470.7 / 523;
          return (
            <motion.div
              key={`${card.id}-${cardIndex}`}
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
