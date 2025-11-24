import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { AnimatedSticker } from '../AnimatedSticker';
import { getCachedStickerUrl, getCachedStickerMediaType, LoadPriority, videoBlobCache, imageLoader } from '@/utils/imageLoader';
import { getStickerImageUrl } from '@/utils/stickerUtils';

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
      <Box
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
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (sticker.is_video || sticker.isVideo || cachedType === 'video') {
    return (
      <video
        key={sticker.file_id}
        src={cachedUrl}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={className}
        style={{
          width,
          height,
          objectFit: 'contain'
        }}
        onLoadedData={onLoad}
        onError={(e) => {
          const video = e.currentTarget;
          const blobUrl = cachedUrl;
          
          if (blobUrl && blobUrl.startsWith('blob:')) {
            videoBlobCache.delete(sticker.file_id).catch(() => {});
            imageLoader.loadVideo(
              sticker.file_id,
              getStickerImageUrl(sticker.file_id),
              LoadPriority.TIER_1_VIEWPORT
            ).then(() => {
              const newBlobUrl = videoBlobCache.get(sticker.file_id);
              if (newBlobUrl && video) {
                video.src = newBlobUrl;
              }
            }).catch(() => {
              if (video) {
                video.src = getStickerImageUrl(sticker.file_id);
              }
            });
          } else {
            if (video) {
              video.src = getStickerImageUrl(sticker.file_id);
            }
          }
          
          if (!sticker.file_id) {
            console.warn(`[StickerPreview] Video failed to load and no file_id available`);
          }
          
          onLoad?.();
        }}
        onCanPlay={() => {
          const video = document.querySelector(`video[src="${cachedUrl}"]`) as HTMLVideoElement;
          if (video && video.paused) {
            video.play().catch((err) => console.warn('Video autoplay failed:', err));
          }
        }}
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
    <Box 
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
      <Box
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
          <Box
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
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.35)',
                borderTopColor: 'rgba(255,255,255,0.9)',
                animation: 'spin 1s linear infinite'
              }}
            />
          </Box>
        )}
        {renderStickerMedia(sticker, {
          className: '',
          width: '100%',
          height: '100%',
          onLoad
        })}
      </Box>
    </Box>
  );
};

