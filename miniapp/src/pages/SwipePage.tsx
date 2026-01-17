import React, { useCallback, useEffect, useMemo } from 'react';
import '../styles/common.css';
import '../styles/SwipePage.css';
import { useSwipeStickerFeed } from '@/hooks/useSwipeStickerFeed';
import { useLikesStore } from '@/store/useLikesStore';
import { useTelegram } from '@/hooks/useTelegram';
import { SwipeCard } from '@/components/SwipeCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LoadPriority } from '@/utils/imageLoader';

export const SwipePage: React.FC = () => {
  const { tg } = useTelegram();
  const { stickerSets, currentIndex, isLoading, error, hasMore, next, reset, totalViewed } =
    useSwipeStickerFeed({ pageSize: 20, preloadThreshold: 5 });

  const toggleLike = useLikesStore((state) => state.toggleLike);

  const visibleCards = useMemo(() => {
    return stickerSets.slice(currentIndex, currentIndex + 3);
  }, [stickerSets, currentIndex]);

  const currentCard = visibleCards[0];

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const handleSwipeDown = useCallback(() => {
    next();
  }, [next]);

  const handleSwipeUp = useCallback(async () => {
    if (!currentCard) return;
    await toggleLike(String(currentCard.id));
    next();
  }, [currentCard, toggleLike, next]);

  if (isLoading && stickerSets.length === 0) {
    return (
      <div className="discover-page">
        <div className="discover-page__loading">
          <LoadingSpinner />
          <p className="discover-page__loading-text">Загружаем стикеры...</p>
        </div>
      </div>
    );
  }

  if (error && stickerSets.length === 0) {
    return (
      <div className="discover-page">
        <div className="discover-page__empty">
          <div className="discover-page__empty-icon">⚠️</div>
          <h2 className="discover-page__empty-title">Не удалось загрузить стикеры</h2>
          <p className="discover-page__empty-description">{error}</p>
          <button className="discover-page__reset-button" onClick={reset}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!hasMore && currentIndex >= stickerSets.length) {
    return (
      <div className="discover-page">
        <div className="discover-page__empty">
          <div className="discover-page__empty-icon">🎉</div>
          <h2 className="discover-page__empty-title">Вы просмотрели все стикеры!</h2>
          <p className="discover-page__empty-description">Просмотрено: {totalViewed} стикерсетов</p>
          <button className="discover-page__reset-button" onClick={reset}>
            Начать сначала
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="discover-page">
      {/* Фоновые градиенты Rectangle 7 и Rectangle 8 из Figma */}
      <div className="discover-page__gradient discover-page__gradient--dislike"></div>
      <div className="discover-page__gradient discover-page__gradient--like"></div>

      {stickerSets.length > 0 && (
        <div className="discover-page__counter">
          <span className="discover-page__counter-text">Просмотрено: {totalViewed}</span>
        </div>
      )}

      {currentCard && (
        <div className="discover-page__cards-wrapper">
          <div className="discover-page__cards">
            {visibleCards.map((stickerSet, index) => {
              const isTop = index === 0;
              const zIndex = visibleCards.length - index;
              const scale = 1 - index * 0.05;
              // Сдвигаем карточки вверх для создания иллюзии бесконечной очереди
              // Первая карточка на месте, вторая и третья сдвинуты вверх
              const translateY = index === 0 ? 0 : index === 1 ? -15 : -25;

              return (
                <div
                  key={`wrapper-${stickerSet.id}-${currentIndex + index}`}
                  className="swipe-card-wrapper"
                  style={{
                    position: 'absolute',
                    zIndex,
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: index < 2 ? 1 : 0.5,
                    transform: `scale(${scale}) translateY(${translateY}px)`,
                    pointerEvents: isTop ? 'auto' : 'none',
                  }}
                >
                  <SwipeCard
                    stickerSet={stickerSet}
                    onSwipeLeft={isTop ? handleSwipeDown : () => {}}
                    onSwipeRight={isTop ? handleSwipeUp : () => {}}
                    isTopCard={isTop}
                    priority={index === 0 ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_4_BACKGROUND}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading && stickerSets.length > 0 && (
        <div className="discover-page__loading-indicator">
          <div className="discover-page__loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default SwipePage;

