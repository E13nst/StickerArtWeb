import { useState, useCallback, ReactNode, FC } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { Toast } from './Toast';
import './SwipeCardStack.css';

export interface SwipeCard {
  id: string | number;
  [key: string]: any;
}

export interface SwipeCardStackProps {
  cards: SwipeCard[];
  onSwipeLeft: (card: SwipeCard) => void;
  onSwipeRight: (card: SwipeCard) => void;
  onEnd: () => void;
  renderCard: (card: SwipeCard, index: number) => ReactNode;
  maxVisibleCards?: number;
  swipeThreshold?: number;
}

export const SwipeCardStack: FC<SwipeCardStackProps> = ({
  cards,
  onSwipeLeft,
  onSwipeRight,
  onEnd,
  renderCard,
  maxVisibleCards = 4,
  swipeThreshold = 100,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<'up' | 'down' | null>(null);
  const [toastState, setToastState] = useState<{
    isVisible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    isVisible: false,
    message: '',
    type: 'success',
  });

  const y = useMotionValue(0);
  const opacity = useTransform(y, [-200, -80, 0, 80, 200], [0, 1, 1, 1, 0]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToastState({
      isVisible: true,
      message,
      type,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      void event;
      const swipeDistance = info.offset.y;
      const swipeVelocity = info.velocity.y;

      if (Math.abs(swipeDistance) > swipeThreshold || Math.abs(swipeVelocity) > 500) {
        const direction = swipeDistance < 0 ? 'up' : 'down';
        setExitDirection(direction);

        const currentCard = cards[currentIndex];

        if (direction === 'down') {
          onSwipeLeft(currentCard);
          showToast('Skipped', 'error');
        } else {
          onSwipeRight(currentCard);
          showToast('Liked', 'success');
        }

        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setExitDirection(null);
          y.set(0);

          if (currentIndex + 1 >= cards.length) {
            onEnd();
          }
        }, 300);
      } else {
        y.set(0);
      }
    },
    [cards, currentIndex, onSwipeLeft, onSwipeRight, onEnd, showToast, swipeThreshold, y]
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
                {renderCard(card, cardIndex)}
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
                {renderCard(card, cardIndex)}
              </div>
            </motion.div>
          );
        })}
      </div>

      <Toast
        message={toastState.message}
        type={toastState.type}
        isVisible={toastState.isVisible}
        onClose={hideToast}
      />
    </>
  );
};
