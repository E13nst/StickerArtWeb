import { useState, useCallback, useEffect, useMemo, useRef, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/common.css';
import '../styles/SwipePage.css';
import { useTelegram } from '@/hooks/useTelegram';
import { useSwipeStickerFeed } from '@/hooks/useSwipeStickerFeed';
import { SwipeCardStack, type SwipeCardActions } from '@/components/ui/SwipeCardStack';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { AnimatedSticker } from '@/components/AnimatedSticker';
import { AuthorDisplay } from '@/components/AuthorDisplay';
import { CloseIcon, FavoriteIcon } from '@/components/ui/Icons';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { getStickerImageUrl, getStickerVideoUrl, formatStickerTitle } from '@/utils/stickerUtils';
import { StickerSetResponse } from '@/types/sticker';
import { imageCache, LoadPriority, imageLoader } from '@/utils/imageLoader';
import { videoBlobCache } from '@/utils/videoBlobCache';
import { useNonFlashingVideoSrc } from '@/hooks/useNonFlashingVideoSrc';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { openTelegramUrl } from '@/utils/openTelegramUrl';

const cn = (...classes: (string | boolean | undefined | null)[]): string =>
  classes.filter(Boolean).join(' ');

type PreviewMedia = {
  fileId: string;
  url: string;
  emoji: string;
  isAnimated: boolean;
  isVideo: boolean;
};

const resolvePreviewMedia = (stickerSet: StickerSetResponse): PreviewMedia | null => {
  const pack = adaptStickerSetsToGalleryPacks([stickerSet])[0];
  const previewSticker = pack?.previewStickers?.[0];

  if (!previewSticker) {
    return null;
  }

  return {
    fileId: previewSticker.fileId,
    url: previewSticker.url || getStickerImageUrl(previewSticker.fileId),
    emoji: previewSticker.emoji || '🎨',
    isAnimated: previewSticker.isAnimated,
    isVideo: previewSticker.isVideo,
  };
};

const SwipeCardVideoPreview: FC<{
  fileId: string;
  url: string;
  emoji: string;
  isActive: boolean;
  stickerIndex: number;
}> = ({ fileId, url, emoji, isActive, stickerIndex }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isIosTelegramWebView =
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    Boolean((window as any).Telegram?.WebApp);
  const preferredSrc = videoBlobCache.get(fileId) ?? undefined;
  const { src, isReady, onError, onLoadedData } = useNonFlashingVideoSrc({
    fileId,
    preferredSrc,
    fallbackSrc: url,
    waitForPreferredMs: 100,
    resolvePreferredSrc: () => videoBlobCache.get(fileId),
    preferPreferredOnly: isIosTelegramWebView,
    preferredPollMs: 100,
    preferredMaxWaitMs: 2500,
    fallbackOnPreferredError: !isIosTelegramWebView,
  });

  useEffect(() => {
    const priority = isActive ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_2_NEAR_VIEWPORT;
    imageLoader.loadVideo(fileId, url, priority, fileId, stickerIndex).catch(() => {});
  }, [fileId, isActive, stickerIndex, url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.load();
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      video.pause();
      return;
    }

    if (!isReady) {
      return;
    }

    video.play?.().catch(() => {});
  }, [isActive, isReady]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {!src && (
        <div
          className="pack-card__placeholder"
          style={{ position: 'absolute', inset: 0 }}
        >
          {emoji || '🎨'}
        </div>
      )}
      <video
        key={fileId}
        ref={videoRef}
        src={src}
        className="pack-card-video"
        autoPlay={isActive}
        loop
        muted
        playsInline
        preload="auto"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 120ms ease',
          backgroundColor: 'transparent'
        }}
        onLoadedData={onLoadedData}
        onError={onError}
      />
    </div>
  );
};

const SHOW_HELLO_KEY = 'swipe-hello-shown';
const SWIPE_GLOW_THRESHOLD = 100;

const BUTTON_GLOW_DURATION_MS = 450;

export const SwipePage: FC = () => {
  const { isInTelegramApp, tg } = useTelegram();
  const [showHello, setShowHello] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [buttonGlow, setButtonGlow] = useState<'like' | 'dislike' | null>(null);
  
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

  // Сброс glow после нажатия на кнопку
  useEffect(() => {
    if (!buttonGlow) return;
    const t = setTimeout(() => setButtonGlow(null), BUTTON_GLOW_DURATION_MS);
    return () => clearTimeout(t);
  }, [buttonGlow]);

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

  // Обработчики свайпа (лёгкий тактильный отклик после свайпа)
  const handleSwipeLeft = useCallback((card: any) => {
    const stickerSet = card as StickerSetResponse;
    swipeDislike(stickerSet.id);
    tg?.HapticFeedback?.impactOccurred('light');
  }, [swipeDislike, tg]);

  const handleSwipeRight = useCallback(async (card: any) => {
    const stickerSet = card as StickerSetResponse;
    await swipeLike(stickerSet.id);
    tg?.HapticFeedback?.impactOccurred('light');
  }, [swipeLike, tg]);

  const handleEnd = useCallback(() => {
    // Когда все карточки просмотрены
    console.log('All cards swiped!');
  }, []);

  const handleDragThresholdCrossed = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('light');
  }, [tg]);

  const handleBeforeLike = useCallback(() => {
    setButtonGlow('like');
  }, []);

  const handleBeforeDislike = useCallback(() => {
    setButtonGlow('dislike');
  }, []);

  const handleDownload = useCallback((stickerSet: StickerSetResponse, fallbackUrl?: string) => {
    const targetUrl = stickerSet.url ?? fallbackUrl;
    if (!targetUrl) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Ссылка недоступна');
      }
      return;
    }
    openTelegramUrl(targetUrl, tg);
  }, [tg]);

  // Рендер карточки для SwipeCardStack. Клик по карточке = download; в футере — dislike/like.
  const renderCard = useCallback((card: any, index: number, actions?: SwipeCardActions) => {
    const stickerSet = card as StickerSetResponse;
    const preview = resolvePreviewMedia(stickerSet);
    const imageUrl = preview?.url || '';
    const isAnimated = Boolean(preview?.isAnimated);
    const isVideo = Boolean(preview?.isVideo);
    const isActiveCard = Boolean(actions);
    const stopPropagation = (event: React.SyntheticEvent) => {
      event.stopPropagation();
    };
    const onCardClick = () => {
      handleDownload(stickerSet, imageUrl);
    };

    return (
      <div
        className="swipe-card"
        role="button"
        tabIndex={0}
        onClick={onCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCardClick();
          }
        }}
        aria-label="Открыть стикерпак"
      >
        <div className="swipe-card__content">
          <Text variant="h2" weight="bold" className="swipe-card__title">
            {formatStickerTitle(stickerSet.title)}
          </Text>
          {stickerSet.authorId != null && (
            <AuthorDisplay
              authorId={stickerSet.authorId}
              username={stickerSet.username}
              firstName={stickerSet.firstName}
              lastName={stickerSet.lastName}
              className="swipe-card__subtitle top-users-link"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>

        <div className="swipe-card__preview">
          <div className="swipe-card__preview-inner pack-card__content">
            {preview ? (
              isAnimated ? (
                <AnimatedSticker
                  fileId={preview.fileId}
                  imageUrl={imageUrl}
                  emoji={preview.emoji}
                  className="pack-card-animated-sticker"
                  hidePlaceholder={true}
                  priority={isActiveCard ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_4_BACKGROUND}
                />
              ) : isVideo ? (
                <SwipeCardVideoPreview
                  fileId={preview.fileId}
                  url={preview.url || getStickerVideoUrl(preview.fileId)}
                  emoji={preview.emoji}
                  isActive={isActiveCard}
                  stickerIndex={index}
                />
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
                    src={imageCache.get(preview.fileId) || imageUrl}
                    alt={formatStickerTitle(stickerSet.title)}
                    className="pack-card-image"
                    loading={isActiveCard ? 'eager' : 'lazy'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              )
            ) : (
              <div className="pack-card__placeholder">
                🎨
              </div>
            )}
          </div>
        </div>

        <div className="swipe-card__footer" onClick={stopPropagation} onPointerDown={stopPropagation} onTouchStart={stopPropagation}>
          <button
            type="button"
            className="swipe-card__action swipe-card__action--dislike"
            onClick={(e) => {
              stopPropagation(e);
              actions?.onBeforeDislike?.();
              actions?.triggerSwipeLeft?.();
            }}
            aria-label="Пропустить"
          >
            <CloseIcon size={24} color="currentColor" />
          </button>
          <button
            type="button"
            className="swipe-card__action swipe-card__action--like"
            onClick={(e) => {
              stopPropagation(e);
              actions?.onBeforeLike?.();
              actions?.triggerSwipeRight?.();
            }}
            aria-label="Нравится"
          >
            <FavoriteIcon size={24} color="currentColor" />
          </button>
        </div>
      </div>
    );
  }, [handleDownload]);

  // Предзагрузка webm для следующих карточек (чтобы при свайпе видео уже было в кэше)
  useEffect(() => {
    const toPreload = stickerSets.slice(currentIndex, currentIndex + 4);
    toPreload.forEach((stickerSet, i) => {
      const preview = resolvePreviewMedia(stickerSet);
      if (!preview?.fileId || !preview.isVideo) return;
      if (videoBlobCache.has(preview.fileId)) return;
      const url = preview.url || getStickerVideoUrl(preview.fileId);
      const priority = i === 0 ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_4_BACKGROUND;
      imageLoader.loadVideo(preview.fileId, url, priority, String(stickerSet.id), 0).catch(() => {});
    });
  }, [stickerSets, currentIndex]);

  // Получаем видимые карточки для SwipeCardStack
  const visibleCards = useMemo(() => {
    return stickerSets.slice(currentIndex, currentIndex + 4);
  }, [stickerSets, currentIndex]);

  const showCardSkeleton = isLoading && stickerSets.length === 0;

  // Сброс свечения при отсутствии карточек или скелетоне
  const showCards = !showCardSkeleton && visibleCards.length > 0;
  useEffect(() => {
    if (!showCards) setDragY(0);
  }, [showCards]);

  // Состояния загрузки и ошибок
  if (isLimitReached && limitInfo) {
    return (
      <div className={cn('page-container', 'swipe-page', isInTelegramApp && 'telegram-app')}>
        <OtherAccountBackground />
        <div className="swipe-page__inner">
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
      </div>
    );
  }

  if (error && stickerSets.length === 0) {
    return (
      <div className={cn('page-container', 'swipe-page', isInTelegramApp && 'telegram-app')}>
        <OtherAccountBackground />
        <div className="swipe-page__inner">
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
      </div>
    );
  }

  if (emptyMessage && currentIndex >= stickerSets.length) {
    return (
      <div className={cn('page-container', 'swipe-page', isInTelegramApp && 'telegram-app')}>
        <OtherAccountBackground />
        <div className="swipe-page__inner">
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
      </div>
    );
  }

  if (!hasMore && currentIndex >= stickerSets.length) {
    return (
      <div className={cn('page-container', 'swipe-page', isInTelegramApp && 'telegram-app')}>
        <OtherAccountBackground />
        <div className="swipe-page__inner">
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
      </div>
    );
  }

  return (
    <div
      className={cn('page-container', 'swipe-page', isInTelegramApp && 'telegram-app')}
      style={
        {
          '--swipe-glow-top': Math.max(
            dragY < 0 ? Math.min(Math.abs(dragY) / SWIPE_GLOW_THRESHOLD, 1) : 0,
            buttonGlow === 'like' ? 1 : 0,
          ),
          '--swipe-glow-bottom': Math.max(
            dragY > 0 ? Math.min(dragY / SWIPE_GLOW_THRESHOLD, 1) : 0,
            buttonGlow === 'dislike' ? 1 : 0,
          ),
        } as React.CSSProperties
      }
    >
      <OtherAccountBackground />
      {/* Свечение по краям при свайпе: зелёный сверху (лайк), красный снизу (дизлайк). Вынесено из inner, чтобы не обрезалось overflow и было видно поверх header. */}
      <div className="swipe-page__glow swipe-page__glow--top" aria-hidden />
      <div className="swipe-page__glow swipe-page__glow--bottom" aria-hidden />
      <div className="swipe-page__inner">

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

      {/* SwipeCardStack или скелетон карточки при подгрузке */}
      {showCardSkeleton ? (
        <div className="swipe-page__cards">
          <div className="swipe-page__card-skeleton" aria-hidden="true">
            <div className="swipe-card swipe-card--skeleton">
              <div className="swipe-card__content">
                <div className="swipe-card-skeleton__title" />
                <div className="swipe-card-skeleton__subtitle" />
              </div>
              <div className="swipe-card__preview">
                <div className="swipe-card__preview-inner">
                  <div className="pack-card-skeleton swipe-card-skeleton__preview" />
                </div>
              </div>
              <div className="swipe-card__footer">
                <div className="swipe-card-skeleton__action" />
                <div className="swipe-card-skeleton__action" />
              </div>
            </div>
          </div>
        </div>
      ) : visibleCards.length > 0 ? (
        <div className="swipe-page__cards">
          <SwipeCardStack
            cards={visibleCards}
            firstCardIndex={currentIndex}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onEnd={handleEnd}
            renderCard={renderCard}
            maxVisibleCards={4}
            swipeThreshold={100}
            onDragY={setDragY}
            onDragThresholdCrossed={handleDragThresholdCrossed}
            onBeforeLike={handleBeforeLike}
            onBeforeDislike={handleBeforeDislike}
          />
        </div>
      ) : null}

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
    </div>
  );
};

export default SwipePage;

