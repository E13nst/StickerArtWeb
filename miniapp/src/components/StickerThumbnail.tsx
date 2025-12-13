import React, { useState, useEffect, useRef } from 'react';
import { getStickerThumbnailUrl } from '@/utils/stickerUtils';
import { imageLoader, getCachedStickerUrl, LoadPriority } from '@/utils/imageLoader';

interface StickerThumbnailProps {
  fileId: string;
  thumbFileId?: string; // file_id для миниатюры 128x128
  emoji?: string;
  className?: string;
  size?: number;
}

export const StickerThumbnail: React.FC<StickerThumbnailProps> = ({
  fileId,
  thumbFileId,
  emoji,
  className,
  size = 128
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Используем thumbFileId если доступен, иначе основной fileId
  const actualFileId = thumbFileId || fileId;
  const imageUrl = getStickerThumbnailUrl(actualFileId, size);
  
  // ✅ Загружаем через imageLoader для предотвращения дубликатов
  useEffect(() => {
    imageLoader.loadImage(actualFileId, imageUrl, LoadPriority.TIER_3_ADDITIONAL)
      .catch((error) => {
        // Логируем только в dev режиме или при реальных ошибках
        if (import.meta.env.DEV) {
          console.error('Failed to load thumbnail:', actualFileId, error);
        }
        setError(true);
      });
  }, [actualFileId, imageUrl]);

  // Проверяем готовность изображения после монтирования
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoading(false);
    }
  }, []);

  const handleLoad = () => {
    // Убрали лог - засоряет консоль при большом количестве миниатюр
    setLoading(false);
  };

  const handleError = () => {
    // Логируем только в dev режиме
    if (import.meta.env.DEV) {
      console.warn('❌ StickerThumbnail load error:', imageUrl);
    }
    setLoading(false);
    setError(true);
  };

  if (error) {
    // Убрали лог - засоряет консоль
    return (
      <div 
        className={className}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: size,
          height: size,
          fontSize: '24px',
          backgroundColor: 'transparent',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        {emoji || '🎨'}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {loading && (
        <div 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '24px',
            backgroundColor: 'transparent',
            borderRadius: '8px'
          }}
        >
          {emoji || '🎨'}
        </div>
      )}
      <img
        ref={imgRef}
        src={getCachedStickerUrl(actualFileId) || imageUrl}  // ✅ Используем кеш если есть
        alt={emoji || ''}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: '8px',
          opacity: loading ? 0 : 1,
          transition: 'opacity 200ms ease',
          backgroundColor: 'transparent'
        }}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
