import React, { useRef, useEffect, useMemo } from 'react';
import { AnimatedSticker } from '../AnimatedSticker';
import { getCachedStickerUrl, getCachedStickerMediaType, LoadPriority, videoBlobCache } from '@/utils/imageLoader';
import { getStickerImageUrl, getStickerVideoUrl } from '@/utils/stickerUtils';
import { useNonFlashingVideoSrc } from '@/hooks/useNonFlashingVideoSrc';

interface StickerPreviewProps {
  sticker: any;
  stickerCount: number;
  isMainLoaded: boolean;
  onLoad: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  touchHandled: React.MutableRefObject<boolean>;
  previewRef: React.RefObject<HTMLDivElement>;
}

// Компонент для видео стикера с использованием useNonFlashingVideoSrc
const StickerPreviewVideo: React.FC<{
  sticker: any;
  width: string;
  height: string;
  className?: string;
  onLoad?: () => void;
}> = ({ sticker, width, height, className, onLoad }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Мемоизируем fallbackVideoUrl, чтобы не пересоздавать хук при каждом рендере
  const fallbackVideoUrl = useMemo(
    () => sticker.url || getStickerVideoUrl(sticker.file_id),
    [sticker.url, sticker.file_id]
  );
  
  const { src, isReady, onError, onLoadedData } = useNonFlashingVideoSrc({
    fileId: sticker.file_id,
    preferredSrc: videoBlobCache.get(sticker.file_id),
    fallbackSrc: fallbackVideoUrl,
    waitForPreferredMs: 100
  });

  const handleLoadedData = () => {
    onLoadedData();
    onLoad?.();
  };

  // Безопасный вызов play() только когда isReady стал true и src изменился
  useEffect(() => {
    if (!isReady) return;
    const video = videoRef.current;
    if (!video) return;
    
    // Пытаемся play() на случай, если autoplay не сработал (например, на iOS)
    // Ошибки игнорируем без логирования - это нормально, если браузер блокирует autoplay
    const playPromise = video.play?.();
    if (playPromise && typeof (playPromise as any).catch === 'function') {
      (playPromise as any).catch(() => {
        // Намеренно игнорируем - не логируем в production, чтобы не засорять консоль
      });
    }
  }, [isReady, src]);

  return (
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
      onLoadedData={handleLoadedData}
      onError={onError}
    />
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
        sx={{
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
            borderTopColor: 'var(--tg-theme-button-color, #2481cc)',
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

export const StickerPreview: React.FC<StickerPreviewProps> = ({
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
      sx={{
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
        sx={{
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
            sx={{
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
              sx={{
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

