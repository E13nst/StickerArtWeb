import { useRef, useEffect, useMemo, FC, MouseEvent, TouchEvent } from 'react';
import { AnimatedSticker } from '../AnimatedSticker';
import { PackCardDebugOverlay } from '../PackCardDebugOverlay';
import { useMediaDiagnostics } from '@/hooks/useMediaDiagnostics';
import { useProfileStore } from '@/store/useProfileStore';
import { getCachedStickerUrl, getCachedStickerMediaType, LoadPriority } from '@/utils/imageLoader';
import { videoBlobCache } from '@/utils/videoBlobCache';
import { getStickerImageUrl, getStickerVideoUrl } from '@/utils/stickerUtils';
import { useNonFlashingVideoSrc } from '@/hooks/useNonFlashingVideoSrc';

interface StickerPreviewProps {
  sticker: any;
  stickerCount: number;
  isMainLoaded: boolean;
  onLoad: () => void;
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
  onTouchCancel: (e: TouchEvent) => void;
  onClick: (e: MouseEvent) => void;
  touchHandled: React.MutableRefObject<boolean>;
  previewRef: React.RefObject<HTMLDivElement>;
}

// Компонент для видео стикера с использованием useNonFlashingVideoSrc
const StickerPreviewVideo: FC<{
  sticker: any;
  width: string;
  height: string;
  className?: string;
  onLoad?: () => void;
}> = ({ sticker, width, height, className, onLoad }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isIosTelegramWebView =
    typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    Boolean((window as any).Telegram?.WebApp);
  
  // Мемоизируем fallbackVideoUrl, чтобы не пересоздавать хук при каждом рендере
  const fallbackVideoUrl = useMemo(
    () => sticker.url || getStickerVideoUrl(sticker.file_id),
    [sticker.url, sticker.file_id]
  );
  
  const { src, isReady, onError, onLoadedData } = useNonFlashingVideoSrc({
    fileId: sticker.file_id,
    preferredSrc: videoBlobCache.get(sticker.file_id),
    fallbackSrc: fallbackVideoUrl,
    waitForPreferredMs: 100,
    resolvePreferredSrc: () => videoBlobCache.get(sticker.file_id),
    preferPreferredOnly: isIosTelegramWebView,
    preferredPollMs: 100,
    preferredMaxWaitMs: 2500,
    fallbackOnPreferredError: !isIosTelegramWebView,
  });

  const handleLoadedData = () => {
    onLoadedData();
    onLoad?.();
  };

  // Диагностика для ADMIN: нормализуем sticker под интерфейс хука
  const currentUserRole = useProfileStore((s) => s.currentUserRole);
  const isAdmin = (currentUserRole ?? '').toUpperCase().includes('ADMIN');
  const stickerForDiag = useMemo(
    () => ({
      fileId: sticker.file_id,
      url: fallbackVideoUrl,
      isVideo: true as const,
    }),
    [sticker.file_id, fallbackVideoUrl]
  );
  const diagnosticsContext = useMemo(
    () => ({
      componentName: 'StickerSetDetail',
      inView: true,
      preferredSrcPresent: Boolean(videoBlobCache.get(sticker.file_id)),
      srcStrategy: src ? (src.startsWith('blob:') ? 'blob' : 'url') : 'unset',
    }),
    [sticker.file_id, src]
  );
  const { diagnostics, reportEvent } = useMediaDiagnostics(
    stickerForDiag,
    videoRef,
    true,
    isAdmin,
    { context: diagnosticsContext }
  );

  // Безопасный вызов play() только когда isReady стал true и src изменился
  useEffect(() => {
    if (!isReady) return;
    const video = videoRef.current;
    if (!video) return;
    
    // Пытаемся play() на случай, если autoplay не сработал (например, на iOS)
    // Ошибки игнорируем без логирования - это нормально, если браузер блокирует autoplay
    reportEvent('play-called');
    const playPromise = video.play?.();
    if (playPromise && typeof (playPromise as any).catch === 'function') {
      (playPromise as Promise<void>)
        .then(() => {
          reportEvent('play-resolved');
        })
        .catch((error) => {
          reportEvent('play-rejected', error instanceof Error ? error.message : 'unknown');
        });
    }
  }, [isReady, reportEvent, src]);

  useEffect(() => {
    if (!src) return;
    reportEvent('src-selected', src.startsWith('blob:') ? 'blob' : 'url');
  }, [reportEvent, src]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <video
        ref={videoRef}
        key={sticker.file_id}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={className}
        style={{
          width,
          height,
          objectFit: 'contain',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 120ms ease',
          backgroundColor: 'transparent'
        }}
        onLoadedData={() => {
          reportEvent('onLoadedData-prop');
          handleLoadedData();
        }}
        onError={(event) => {
          reportEvent('onError-prop');
          onError(event);
        }}
      />
      {isAdmin && diagnostics?.hasFailed && (
        <PackCardDebugOverlay result={diagnostics} fileId={sticker.file_id} />
      )}
    </div>
  );
};

const renderStickerMedia = (
  sticker: any,
  opts: {
    size?: number | string;
    width?: number | string;
    height?: number | string;
    className?: string;
    onLoad?: () => void;
  } = {}
) => {
  if (!sticker) return null;
  const { size, width: widthProp, height: heightProp, className, onLoad } = opts;
  const computedWidth = widthProp ?? size ?? '100%';
  const computedHeight = heightProp ?? size ?? '100%';
  const width = typeof computedWidth === 'number' ? `${computedWidth}px` : computedWidth;
  const height = typeof computedHeight === 'number' ? `${computedHeight}px` : computedHeight;
  const cachedUrl = getCachedStickerUrl(sticker.file_id);
  const cachedType = getCachedStickerMediaType(sticker.file_id);

  if (sticker.is_animated || sticker.isAnimated) {
    // ✅ WebP анимации загружаются как изображения, проверяем тип
    // Если в кеше есть изображение (WebP), используем <img>, иначе Lottie через AnimatedSticker
    if (cachedType === 'image' && cachedUrl) {
      // WebP анимация - браузер автоматически поддерживает анимацию
      console.log(`🎬 [StickerPreview] WebP анимация обнаружена для ${sticker.file_id.slice(-8)}, используем <img>`);
      return (
        <img
          src={cachedUrl}
          alt={sticker.emoji || ''}
          className={className}
          style={{
            width,
            height,
            objectFit: 'contain'
          }}
          loading="eager"
          onLoad={onLoad}
        />
      );
    }
    
    // Lottie анимация (JSON) или еще не загружено
    if (cachedType) {
      console.log(`🎬 [StickerPreview] Тип кеша для ${sticker.file_id.slice(-8)}: ${cachedType}, используем AnimatedSticker`);
    } else {
      console.log(`🎬 [StickerPreview] Кеш пуст для ${sticker.file_id.slice(-8)}, используем AnimatedSticker (будет загружено)`);
    }
    return (
      <AnimatedSticker
        fileId={sticker.file_id}
        imageUrl={getStickerImageUrl(sticker.file_id)}
        hidePlaceholder={false}
        className={className}
        onReady={onLoad}
        priority={LoadPriority.TIER_0_MODAL}
      />
    );
  }

  if (!cachedUrl) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '8px'
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: 'var(--color-button)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (sticker.is_video || sticker.isVideo || cachedType === 'video') {
    return (
      <StickerPreviewVideo
        sticker={sticker}
        width={width}
        height={height}
        className={className}
        onLoad={onLoad}
      />
    );
  }

  return (
    <img
      src={cachedUrl}
      alt={sticker.emoji || ''}
      className={className}
      style={{
        width,
        height,
        objectFit: 'contain'
      }}
      loading="eager"
      onLoad={onLoad}
    />
  );
};

export const StickerPreview: FC<StickerPreviewProps> = ({
  sticker,
  stickerCount,
  isMainLoaded,
  onLoad,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onClick,
  touchHandled,
  previewRef
}) => {
  return (
    <div 
      ref={previewRef}
      key={sticker?.file_id || `preview-${sticker?.file_id}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'relative',
        width: 'min(75vw, 42vh)',
        maxWidth: 377,
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: stickerCount > 1 ? 'pointer' : 'default',
          touchAction: 'pan-y'
        }}
        onClick={(event) => {
          if (touchHandled.current) {
            touchHandled.current = false;
            return;
          }
          if (stickerCount <= 1) return;
          onClick(event);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {!isMainLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.08)',
              pointerEvents: 'none',
              transition: 'opacity 120ms ease',
              opacity: isMainLoaded ? 0 : 1
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.35)',
                borderTopColor: 'rgba(255,255,255,0.9)',
                animation: 'spin 1s linear infinite'
              }}
            />
          </div>
        )}
        {renderStickerMedia(sticker, {
          className: '',
          width: '100%',
          height: '100%',
          onLoad
        })}
      </div>
    </div>
  );
};
