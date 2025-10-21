import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useNearVisible } from '../hooks/useNearVisible';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { useGalleryStore } from '../store/useGalleryStore';
import { AnimatedSticker } from './AnimatedSticker';
import { getTrulyRandomEmojisFromPack } from '../utils/emojiUtils';

interface Pack {
  id: string;
  title: string;
  posters: Array<{ 
    fileId: string; 
    url: string; 
    isAnimated?: boolean;
    emoji?: string;
  }>;
  allStickers?: Array<{ 
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

const PackCardComponent: React.FC<PackCardProps> = ({ 
  pack, 
  isFirstRow = false,
  isHighPriority = false,
  onClick 
}) => {
  const { ref, isNear } = useNearVisible({ rootMargin: '800px' });
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [randomEmojis, setRandomEmojis] = useState<string[]>([]);
  
  const { setPostersByPack, postersByPack } = useGalleryStore();
  
  // Мемоизированный выбор постеров - теперь просто возвращаем все постеры
  // так как случайный выбор уже сделан в galleryAdapter
  const selectedPosters = useMemo(() => {
    if (pack.posters.length === 0) return [];
    
    console.log('🎨 Pack', pack.id, 'showing', pack.posters.length, 'posters');
    return pack.posters;
  }, [pack.id, pack.posters]);

  // Обновляем случайные эмодзи при изменении данных пака
  // Используем все стикеры пака для выбора эмодзи, а не только превью
  useEffect(() => {
    const stickersForEmoji = pack.allStickers && pack.allStickers.length > 0 
      ? pack.allStickers 
      : pack.posters;
    
    const newEmojis = getTrulyRandomEmojisFromPack(stickersForEmoji, 3);
    setRandomEmojis(newEmojis);
  }, [pack.allStickers, pack.posters]);

  // Используем прогрессивную загрузку
  const {
    loadedImages,
    currentImageIndex,
    isFirstImageLoaded,
    hasError,
    shouldShowSlideshow
  } = useProgressiveLoading({
    packId: pack.id,
    selectedPosters: selectedPosters || [],
    isHighPriority,
    isVisible: isNear && !isDocumentHidden
  });

  // Мемоизированный рендеринг изображений - показываем сразу после загрузки
  const renderedImages = useMemo(() => {
    return loadedImages.map((imageUrl, index) => {
      const poster = selectedPosters[index];
      // Показываем слайдшоу только если загружено больше одного изображения
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
            transition: shouldShowSlideshow ? 'opacity 0.5s ease-in-out' : 'none'
          }}
        >
          {poster?.isAnimated && poster.fileId && imageUrl ? (
            <AnimatedSticker
              fileId={poster.fileId}
              imageUrl={imageUrl}
              emoji={poster.emoji}
              className="pack-card-animated-sticker"
            />
          ) : (
            <img
              src={imageUrl}
              alt={poster?.emoji || 'Sticker'}
              className="pack-card-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              loading={isHighPriority ? 'eager' : 'lazy'}
              decoding="async"
            />
          )}
        </div>
      );
    });
  }, [loadedImages, selectedPosters, shouldShowSlideshow, currentImageIndex, pack.id, isHighPriority]);

  // Отслеживаем видимость документа
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentHidden(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Проверяем настройки анимации
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Сохраняем выбранные постеры в store
  useEffect(() => {
    if (selectedPosters.length > 0) {
      setPostersByPack(pack.id, selectedPosters.map(p => p.fileId));
    }
  }, [pack.id, selectedPosters, setPostersByPack]);

  // Мемоизированный обработчик клика
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(pack.id);
    }
  }, [onClick, pack.id]);


  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="pack-card"
      onClick={handleClick}
      style={{
        minHeight: '200px',
        height: '200px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: '0 2px 8px var(--tg-theme-shadow-color)',
        touchAction: 'manipulation',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
      onMouseEnter={(e) => {
        if (window.matchMedia('(hover: hover)').matches) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 16px var(--tg-theme-shadow-color)';
        }
      }}
      onMouseLeave={(e) => {
        if (window.matchMedia('(hover: hover)').matches) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px var(--tg-theme-shadow-color)';
        }
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
          <div style={{ fontSize: '12px', opacity: 0.7 }}>Error loading...</div>
        </div>
      ) : (
        <div className="slideshow-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
          {renderedImages}
          {/* Показываем индикатор загрузки дополнительных изображений */}
          {loadedImages.length < selectedPosters.length && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--tg-theme-overlay-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'white',
              backdropFilter: 'blur(4px)'
            }}>
              {loadedImages.length}/{selectedPosters.length}
            </div>
          )}
        </div>
      )}
      
      {/* Заголовок пака */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: `linear-gradient(transparent, var(--tg-theme-overlay-color))`,
          color: 'white',
          padding: '12px 8px 8px',
          fontSize: '14px',
          fontWeight: '500',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {pack.title}
      </div>

      {/* Случайные эмодзи */}
      {randomEmojis.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            maxWidth: 'calc(100% - 16px)'
          }}
        >
          {randomEmojis.map((emoji, index) => (
            <span
              key={`${emoji}-${index}-${pack.id}`}
              style={{
                fontSize: '16px',
                lineHeight: 1,
                background: 'var(--tg-theme-overlay-color)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              title={`Эмодзи из стикерпака: ${emoji}`}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const PackCard = memo(PackCardComponent);