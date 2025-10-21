import React, { useEffect, useState } from 'react';
import { useNearVisible } from '../hooks/useNearVisible';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { useGalleryStore } from '../store/useGalleryStore';
import { AnimatedSticker } from './AnimatedSticker';

interface Pack {
  id: string;
  title: string;
  posters: Array<{ 
    fileId: string; 
    url: string; 
    isAnimated?: boolean;
    emoji?: string;
  }>;
}

interface PackCardProps {
  pack: Pack;
  isFirstRow?: boolean;
  isHighPriority?: boolean; // Для первых 6 паков на экране
  onClick?: (packId: string) => void;
}

export const PackCard: React.FC<PackCardProps> = ({ 
  pack, 
  isFirstRow = false,
  isHighPriority = false,
  onClick 
}) => {
  const { ref, isNear } = useNearVisible({ rootMargin: '800px' });
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  const { setPostersByPack, postersByPack } = useGalleryStore();
  
  // Выбрать случайные 4 постеры для этого пака
  const [selectedPosters, setSelectedPosters] = useState<Pack['posters']>([]);

  // Используем прогрессивную загрузку
  const {
    loadedImages,
    currentImageIndex,
    isFirstImageLoaded,
    isLoading,
    hasError,
    progress,
    canLoadMore
  } = useProgressiveLoading({
    packId: pack.id,
    selectedPosters,
    isHighPriority,
    isVisible: isNear && !isDocumentHidden,
    onImageLoaded: (imageUrl, index) => {
      console.log(`🎨 Image ${index + 1} loaded for pack ${pack.id}:`, imageUrl);
    },
    onAllImagesLoaded: () => {
      console.log(`🎉 All images loaded for pack ${pack.id}`);
    }
  });
  
  // Инициализация выбранных постеров (всегда случайные 4)
  useEffect(() => {
    if (pack.posters.length > 0) {
      // Случайно выбираем 4 стикера из доступных
      const shuffled = [...pack.posters].sort(() => Math.random() - 0.5);
      const randomFour = shuffled.slice(0, 4);
      setSelectedPosters(randomFour);
      
      // Сохраняем в store для будущего использования
      setPostersByPack(pack.id, randomFour.map(p => p.fileId));
    }
  }, [pack.id, pack.posters, setPostersByPack]);

  // Отслеживание скрытия документа
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentHidden(document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Отслеживание prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Слайдшоу работает только если не включен режим reduced motion
  const shouldShowSlideshow = loadedImages.length >= 2 && !isDocumentHidden && !prefersReducedMotion;


  const handleClick = () => {
    if (onClick) {
      onClick(pack.id);
    }
  };

  return (
    <div
      ref={ref}
      className="pack-card"
      onClick={handleClick}
      style={{
        width: '100%',
        height: '200px',
        borderRadius: 'var(--tg-radius-m)',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s ease'
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {!isFirstImageLoaded ? (
        <div className="pack-card-skeleton" />
      ) : hasError ? (
        <div 
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            color: 'var(--tg-theme-hint-color)',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div>{selectedPosters[0]?.emoji || '🎨'}</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>Loading...</div>
        </div>
      ) : (
                <div className="slideshow-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {loadedImages.map((imageUrl, index) => {
                    console.log(`🎨 Rendering image ${index}:`, imageUrl);
                    const poster = selectedPosters[index];
                    const isActive = shouldShowSlideshow ? index === currentImageIndex : index === 0;
                    
                    return (
              <div
                key={`${pack.id}-${poster?.fileId || index}`}
                className={`slideshow-image ${isActive ? 'active' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 0.5s ease-in-out'
                }}
              >
                {poster?.isAnimated ? (
                  <AnimatedSticker
                    fileId={poster.fileId}
                    imageUrl={imageUrl}
                    emoji={poster.emoji}
                    className="pack-card-animated-sticker"
                    hidePlaceholder={true}
                  />
                        ) : (
                          <img
                            src={imageUrl}
                            alt={pack.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              padding: 'var(--tg-spacing-2)',
                              decoding: isFirstRow ? 'async' : 'auto',
                              fetchPriority: isFirstRow ? 'high' : 'auto'
                            }}
                            onLoad={() => {
                              console.log(`✅ Image loaded successfully: ${imageUrl}`);
                            }}
                    onError={(e) => {
                      const poster = selectedPosters[index];
                      console.warn('Image load error for:', imageUrl, 'Poster:', poster?.fileId || 'unknown', 'Index:', index);
                      
                      // Ошибка обрабатывается в хуке useProgressiveLoading
                      console.warn('Image load error handled by progressive loading hook');
                    }}
                  />
                )}
                
              </div>
            );
          })}
        </div>
      )}
      
      {/* Индикатор прогресса загрузки */}
      {isLoading && canLoadMore && (
        <div
          style={{
            position: 'absolute',
            top: 'var(--tg-spacing-1)',
            left: 'var(--tg-spacing-1)',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            fontSize: '10px',
            fontWeight: '600',
            padding: '2px 6px',
            borderRadius: '4px',
            backdropFilter: 'blur(10px)'
          }}
        >
          {Math.round(progress)}% ({loadedImages.length}/{selectedPosters.length})
        </div>
      )}

      {/* Заголовок пака */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          color: 'white',
          padding: 'var(--tg-spacing-3)',
          fontSize: 'var(--tg-font-size-s)',
          fontWeight: '600',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {pack.title}
      </div>
    </div>
  );
};
