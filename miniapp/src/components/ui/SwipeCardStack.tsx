import React, { useState, useCallback } from 'react';
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
  renderCard: (card: SwipeCard, index: number) => React.ReactNode;
  maxVisibleCards?: number;
  swipeThreshold?: number;
}

export const SwipeCardStack: React.FC<SwipeCardStackProps> = ({
  cards,
  onSwipeLeft,
  onSwipeRight,
  onEnd,
  renderCard,
  maxVisibleCards = 4,
  swipeThreshold = 100,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [toastState, setToastState] = useState<{
    isVisible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    isVisible: false,
    message: '',
    type: 'success',
  });

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

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
      const swipeDistance = info.offset.x;
      const swipeVelocity = info.velocity.x;

      if (Math.abs(swipeDistance) > swipeThreshold || Math.abs(swipeVelocity) > 500) {
        const direction = swipeDistance > 0 ? 'right' : 'left';
        setExitDirection(direction);

        const currentCard = cards[currentIndex];

        if (direction === 'left') {
          onSwipeLeft(currentCard);
          showToast('Skipped', 'error');
        } else {
          onSwipeRight(currentCard);
          showToast('Liked', 'success');
        }

        // Move to next card
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setExitDirection(null);
          x.set(0);

          // Check if all cards are swiped
          if (currentIndex + 1 >= cards.length) {
            onEnd();
          }
        }, 300);
      } else {
        // Return to center
        x.set(0);
      }
    },
    [cards, currentIndex, onSwipeLeft, onSwipeRight, onEnd, showToast, swipeThreshold, x]
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
                  x: exitDirection ? undefined : x,
                  rotate: exitDirection ? undefined : rotate,
                  opacity: exitDirection ? undefined : opacity,
                  zIndex: maxVisibleCards - index,
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={handleDragEnd}
                animate={
                  exitDirection
                    ? {
                        x: exitDirection === 'left' ? -400 : 400,
                        rotate: exitDirection === 'left' ? -20 : 20,
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

          // Background cards
          return (
            <motion.div
              key={`${card.id}-${cardIndex}`}
              className="swipe-card-stack__card swipe-card-stack__card--background"
              style={{
                zIndex: maxVisibleCards - index,
              }}
              initial={{
                scale: 1 - index * 0.05,
                y: index * 10,
              }}
              animate={{
                scale: 1 - index * 0.05,
                y: index * 10,
              }}
              transition={{ duration: 0.3 }}
            >
              {renderCard(card, cardIndex)}
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
