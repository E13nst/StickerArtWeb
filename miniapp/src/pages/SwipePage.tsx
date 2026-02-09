import { useState, useCallback, useEffect, useMemo, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/common.css';
import '../styles/SwipePage.css';
import { useSwipeStickerFeed } from '@/hooks/useSwipeStickerFeed';
import { SwipeCardStack } from '@/components/ui/SwipeCardStack';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { getStickerImageUrl } from '@/utils/stickerUtils';
import { StickerSetResponse } from '@/types/sticker';

const SHOW_HELLO_KEY = 'swipe-hello-shown';

export const SwipePage: FC = () => {
  const [showHello, setShowHello] = useState(false);
  
  const {
    stickerSets,
    currentIndex,
    isLoading,
    error,
    hasMore,
    reset,
    totalViewed,
    swipeStats,
    isLimitReached,
    limitInfo,
    emptyMessage,
    swipeLike,
    swipeDislike
  } = useSwipeStickerFeed({ pageSize: 20, preloadThreshold: 5 });

  // Проверяем, первый ли раз пользователь на странице Swipe
  useEffect(() => {
    const hasShownHello = localStorage.getItem(SHOW_HELLO_KEY);
    if (!hasShownHello && !isLoading) {
      setShowHello(true);
    }
  }, [isLoading]);

  // Закрытие приветственного экрана
  const handleCloseHello = useCallback(() => {
    localStorage.setItem(SHOW_HELLO_KEY, 'true');
    setShowHello(false);
  }, []);

  // Блокируем прокрутку страницы
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

  // Обработчики свайпа
  const handleSwipeLeft = useCallback((card: any) => {
    const stickerSet = card as StickerSetResponse;
    swipeDislike(stickerSet.id);
  }, [swipeDislike]);

  const handleSwipeRight = useCallback(async (card: any) => {
    const stickerSet = card as StickerSetResponse;
    await swipeLike(stickerSet.id);
  }, [swipeLike]);

  const handleEnd = useCallback(() => {
    // Когда все карточки просмотрены
    console.log('All cards swiped!');
  }, []);

  const handleDownload = useCallback((stickerSet: StickerSetResponse, fallbackUrl?: string) => {
    const targetUrl = stickerSet.url ?? fallbackUrl;
    if (!targetUrl) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Ссылка недоступна');
      }
      return;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, []);

  // Рендер карточки для SwipeCardStack
  const renderCard = useCallback((card: any, index: number) => {
    const stickerSet = card as StickerSetResponse;
    const previewSticker = stickerSet.telegramStickerSetInfo?.stickers?.[0];
    const imageUrl = previewSticker ? getStickerImageUrl(previewSticker.file_id) : '';
    const stopPropagation = (event: React.SyntheticEvent) => {
      event.stopPropagation();
    };

    return (
      <div className="swipe-card">
        <div className="swipe-card__content">
          <Text variant="h2" weight="bold" className="swipe-card__title">
            {stickerSet.title}
          </Text>
          <Text variant="body" color="primary" className="swipe-card__subtitle">
            @{stickerSet.name}
          </Text>
        </div>

        <div className="swipe-card__preview">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={stickerSet.title}
              className="swipe-card__image"
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          )}
        </div>

        <div className="swipe-card__footer">
          <Button
            variant="primary"
            size="large"
            className="swipe-card__button"
            onClick={(event) => {
              stopPropagation(event);
              handleDownload(stickerSet, imageUrl);
            }}
            onPointerDown={stopPropagation}
            onTouchStart={stopPropagation}
          >
            Download
          </Button>
          
          <div className="swipe-card__info">
            <Text variant="caption" color="secondary">
              {stickerSet.telegramStickerSetInfo?.stickers?.length || 0} stickers
            </Text>
          </div>
        </div>
      </div>
    );
  }, []);

  // Получаем видимые карточки для SwipeCardStack
  const visibleCards = useMemo(() => {
    return stickerSets.slice(currentIndex, currentIndex + 4);
  }, [stickerSets, currentIndex]);

  // Состояния загрузки и ошибок
  if (isLimitReached && limitInfo) {
    return (
      <div className="swipe-page">
        <div className="swipe-page__empty">
          <div className="swipe-page__empty-icon">⛔</div>
          <Text variant="h2" weight="bold" align="center">
            Достигнут дневной лимит: {limitInfo.currentSwipes}/{limitInfo.dailyLimit}
          </Text>
          <Text variant="body" color="secondary" align="center">
            {limitInfo.resetDescription}
          </Text>
          <Button variant="primary" onClick={reset}>
            Проверить снова
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading && stickerSets.length === 0) {
    return (
      <div className="swipe-page">
        <div className="swipe-page__loading">
          <LoadingSpinner />
          <Text variant="body" color="secondary">
            Загружаем стикеры...
          </Text>
        </div>
      </div>
    );
  }

  if (error && stickerSets.length === 0) {
    return (
      <div className="swipe-page">
        <div className="swipe-page__empty">
          <div className="swipe-page__empty-icon">⚠️</div>
          <Text variant="h2" weight="bold" align="center">
            Не удалось загрузить стикеры
          </Text>
          <Text variant="body" color="secondary" align="center">
            {error}
          </Text>
          <Button variant="primary" onClick={reset}>
            Попробовать снова
          </Button>
        </div>
      </div>
    );
  }

  if (emptyMessage && currentIndex >= stickerSets.length) {
    return (
      <div className="swipe-page">
        <div className="swipe-page__empty">
          <div className="swipe-page__empty-icon">🎉</div>
          <Text variant="h2" weight="bold" align="center">
            {emptyMessage}
          </Text>
          <Button variant="primary" onClick={reset}>
            Попробовать снова
          </Button>
        </div>
      </div>
    );
  }

  if (!hasMore && currentIndex >= stickerSets.length) {
    return (
      <div className="swipe-page">
        <div className="swipe-page__empty">
          <div className="swipe-page__empty-icon">🎉</div>
          <Text variant="h2" weight="bold" align="center">
            Вы просмотрели все стикеры!
          </Text>
          <Text variant="body" color="secondary" align="center">
            Просмотрено: {totalViewed} стикерсетов
          </Text>
          <Button variant="primary" onClick={reset}>
            Начать сначала
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="swipe-page">
      {/* Swipe Stats */}
      {swipeStats && (
        <div className="swipe-page__stats">
          <Text variant="bodySmall" color="secondary">
            Свайпы
          </Text>
          <Text variant="body" weight="bold">
            {swipeStats.isUnlimited
              ? 'Безлимит'
              : `${swipeStats.dailySwipes}/${swipeStats.dailyLimit}`}
          </Text>
        </div>
      )}

      {/* Background Pattern */}
      <div className="swipe-page__background">
        <div className="swipe-page__background-item" />
        <div className="swipe-page__background-item" />
        <div className="swipe-page__background-item" />
        <div className="swipe-page__background-item" />
      </div>

      {/* Swipe Gradients */}
      <div className="swipe-page__gradient swipe-page__gradient--green" />
      <div className="swipe-page__gradient swipe-page__gradient--red" />

      {/* SwipeCardStack Component */}
      {visibleCards.length > 0 && (
        <div className="swipe-page__cards">
          <SwipeCardStack
            cards={visibleCards}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onEnd={handleEnd}
            renderCard={renderCard}
            maxVisibleCards={4}
            swipeThreshold={100}
          />
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && stickerSets.length > 0 && (
        <div className="swipe-page__loading-indicator">
          <div className="swipe-page__loading-spinner" />
        </div>
      )}

      {/* Swipe Hello Screen (Overlay) */}
      <AnimatePresence>
        {showHello && (
          <motion.div
            className="swipe-hello"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="swipe-hello__content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Text variant="h1" weight="bold" align="center" className="swipe-hello__title">
                How it works
              </Text>

              <div className="swipe-hello__instructions">
                <div className="swipe-hello__instruction">
                  <Text variant="body" align="left">
                    Swipe up - I want to go
                  </Text>
                </div>
                <div className="swipe-hello__instruction">
                  <Text variant="body" align="left">
                    Swipe down - skip
                  </Text>
                </div>
              </div>

              <Button
                variant="ghost"
                size="large"
                onClick={handleCloseHello}
                className="swipe-hello__button"
              >
                <Text variant="body" color="secondary">
                  Click to continue
                </Text>
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SwipePage;

