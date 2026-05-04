import { useCallback, memo, useEffect, useRef, useMemo, FC } from 'react';
import { useInView } from 'react-intersection-observer';
import { AnimatedSticker } from './AnimatedSticker';
import { InteractiveLikeCount } from './InteractiveLikeCount';
import { PackCardDebugOverlay } from './PackCardDebugOverlay';
import { useMediaDiagnostics } from '../hooks/useMediaDiagnostics';
import { useNonFlashingVideoSrc } from '../hooks/useNonFlashingVideoSrc';
import { useProfileStore } from '../store/useProfileStore';
import { imageLoader, imageCache, LoadPriority } from '../utils/imageLoader';
import { videoBlobCache } from '../utils/videoBlobCache';
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
}

interface PackVideoSticker {
  fileId: string;
  url: string;
  emoji: string;
  isVideo: boolean;
}

const PackCardVideoPreview: FC<{
  sticker: PackVideoSticker;
  inView: boolean;
  stickerIndex: number;
}> = ({ sticker, inView, stickerIndex }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isIosTelegramWebView =
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    Boolean((window as any).Telegram?.WebApp);
  const preferredSrc = videoBlobCache.get(sticker.fileId) ?? undefined;
  const { src, isReady, onError, onLoadedData } = useNonFlashingVideoSrc({
    fileId: sticker.fileId,
    preferredSrc,
    fallbackSrc: sticker.url,
    waitForPreferredMs: 100,
    resolvePreferredSrc: () => videoBlobCache.get(sticker.fileId),
    preferPreferredOnly: isIosTelegramWebView,
    preferredPollMs: 100,
    preferredMaxWaitMs: 2500,
    fallbackOnPreferredError: !isIosTelegramWebView,
  });

  const currentUserRole = useProfileStore((s) => s.currentUserRole);
  const isAdmin = (currentUserRole ?? '').toUpperCase().includes('ADMIN');
  const diagnosticsSticker = useMemo(
    () => ({
      fileId: sticker.fileId,
      url: sticker.url,
      isVideo: true as const,
    }),
    [sticker.fileId, sticker.url]
  );
  const diagnosticsContext = useMemo(
    () => ({
      componentName: 'PackCard',
      inView,
      stickerIndex,
      preferredSrcPresent: Boolean(preferredSrc),
      srcStrategy: src ? (src.startsWith('blob:') ? 'blob' : 'url') : 'unset',
    }),
    [inView, preferredSrc, src, stickerIndex]
  );
  const { diagnostics, reportEvent } = useMediaDiagnostics(
    diagnosticsSticker,
    videoRef,
    inView,
    isAdmin,
    { context: diagnosticsContext }
  );

  useEffect(() => {
    const priority = inView ? LoadPriority.TIER_1_VIEWPORT : LoadPriority.TIER_2_NEAR_VIEWPORT;

    reportEvent('prefetch-requested', String(priority));
    imageLoader
      .loadVideo(sticker.fileId, sticker.url, priority, sticker.fileId, stickerIndex)
      .then(() => {
        reportEvent('prefetch-resolved');
      })
      .catch((error) => {
        reportEvent('prefetch-failed', error instanceof Error ? error.message : 'unknown');
      });
  }, [inView, reportEvent, sticker.fileId, sticker.url, stickerIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    reportEvent('src-selected', src.startsWith('blob:') ? 'blob' : 'url');
    // Safari/WKWebView надёжнее подхватывает новый источник после явного load().
    reportEvent('load-called');
    video.load();
  }, [src, reportEvent]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!inView) {
      reportEvent('pause-out-of-view');
      video.pause();
      return;
    }

    if (!isReady) {
      return;
    }

    reportEvent('play-called');
    const playPromise = video.play?.();
    if (playPromise && typeof (playPromise as Promise<void>).catch === 'function') {
      playPromise
        .then(() => {
          reportEvent('play-resolved');
        })
        .catch((error) => {
          reportEvent('play-rejected', error instanceof Error ? error.message : 'unknown');
        });
    }
  }, [inView, isReady, reportEvent]);

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
          {sticker.emoji || '🎨'}
        </div>
      )}
      <video
        key={sticker.fileId}
        ref={videoRef}
        src={src}
        className="pack-card-video"
        autoPlay={inView}
        loop
        muted
        playsInline
        preload="auto"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 120ms ease'
        }}
        onLoadedData={onLoadedData}
        onError={onError}
      />
      {isAdmin && diagnostics?.hasFailed && (
        <PackCardDebugOverlay result={diagnostics} fileId={sticker.fileId} />
      )}
    </div>
  );
};

const PackCardComponent: FC<PackCardProps> = ({ 
  pack, 
  onClick
}) => {
  // Используем react-intersection-observer для ленивой загрузки
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px', // Начинаем загрузку за 200px до появления
    triggerOnce: false, // Позволяет паузить видео при выходе из viewport
  });

  const isDimmed = pack.isBlocked || pack.isDeleted;
  const activeSticker = pack.previewStickers[0];

  // Форматируем заголовок один раз при изменении pack.title
  const formattedTitle = useMemo(() => {
    try {
      return formatStickerTitle(pack.title);
    } catch (error) {
      console.error('[FORMAT] Error formatting title:', error);
      return pack.title || '';
    }
  }, [pack.title]);

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
                <PackCardVideoPreview
                  key={activeSticker.fileId}
                  sticker={{
                    fileId: activeSticker.fileId,
                    url: activeSticker.url,
                    emoji: activeSticker.emoji,
                    isVideo: true,
                  }}
                  inView={inView}
                  stickerIndex={0}
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

      {/* Лайк */}
      <InteractiveLikeCount
        packId={pack.id}
        size="medium"
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
         prev.onClick === next.onClick;
});
