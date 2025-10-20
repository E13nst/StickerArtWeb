import React, { useState } from 'react';
import { getStickerThumbnailUrl } from '@/utils/stickerUtils';

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

  // Используем thumbFileId если доступен, иначе основной fileId
  const actualFileId = thumbFileId || fileId;
  const imageUrl = getStickerThumbnailUrl(actualFileId, size);
  
  // Отладочная информация
  console.log('🖼️ StickerThumbnail:', { fileId, thumbFileId, actualFileId, size, imageUrl });

  const handleLoad = () => {
    console.log('✅ Image loaded:', imageUrl);
    setLoading(false);
  };

  const handleError = () => {
    console.error('❌ Image load error:', imageUrl);
    setLoading(false);
    setError(true);
  };

  if (error) {
    console.log('❌ StickerThumbnail error fallback:', { fileId, imageUrl });
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
          backgroundColor: 'rgba(0,0,0,0.1)',
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
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '8px'
          }}
        >
          {emoji || '🎨'}
        </div>
      )}
      <img
        src={imageUrl}
        alt={emoji || ''}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: '8px',
          opacity: loading ? 0 : 1,
          transition: 'opacity 200ms ease'
        }}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
