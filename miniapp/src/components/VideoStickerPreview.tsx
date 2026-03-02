import { useEffect, useState, FC } from 'react';
import { videoBlobCache, imageLoader, LoadPriority } from '@/utils/imageLoader';
import { TransparentVideo } from '@/components/ui/TransparentVideo';
import { getStickerVideoUrlHevc } from '@/utils/stickerUtils';

interface VideoStickerPreviewProps {
  fileId: string;
  url: string;
  emoji?: string;
  autoPlay?: boolean;
  packId?: string;
  imageIndex?: number;
  priority?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Превью webm-стикера с предзагрузкой в videoBlobCache.
 * Без предзагрузки видео не отображается (fetch без initData возвращает 401).
 */
export const VideoStickerPreview: FC<VideoStickerPreviewProps> = ({
  fileId,
  url,
  emoji = '🎨',
  autoPlay = false,
  packId = '',
  imageIndex = 0,
  priority = LoadPriority.TIER_1_VIEWPORT,
  className = 'pack-card-video',
  style = {},
}) => {
  const [blobReady, setBlobReady] = useState(() => videoBlobCache.has(fileId));

  useEffect(() => {
    if (!fileId || !url) return;
    if (videoBlobCache.has(fileId)) {
      setBlobReady(true);
      return;
    }
    setBlobReady(false);
    imageLoader.loadVideo(fileId, url, priority, packId, imageIndex)
      .then(() => setBlobReady(true))
      .catch(() => {});
  }, [fileId, url, priority, packId, imageIndex]);

  if (!blobReady && !videoBlobCache.has(fileId)) {
    return (
      <div className="pack-card__placeholder" style={{ width: '100%', height: '100%', ...style }}>
        {emoji}
      </div>
    );
  }

  const webmSrc = videoBlobCache.get(fileId) || url;
  const hevcUrl = getStickerVideoUrlHevc(fileId);

  return (
    <TransparentVideo
      webmSrc={webmSrc}
      hevcUrl={hevcUrl || undefined}
      className={className}
      autoPlay={autoPlay}
      loop
      muted
      playsInline
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', ...style }}
    />
  );
};
