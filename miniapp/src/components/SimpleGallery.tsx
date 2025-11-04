import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PackCard } from './PackCard';
import { VirtualizedGallery } from './VirtualizedGallery';
import { useSmartCache } from '../hooks/useSmartCache';

interface Pack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    emoji: string;
  }>;
}

interface SimpleGalleryProps {
  packs: Pack[];
  onPackClick?: (packId: string) => void;
  enablePreloading?: boolean;
  batchSize?: number;
  // Пагинация
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export const SimpleGallery: React.FC<SimpleGalleryProps> = ({
  packs,
  onPackClick,
  enablePreloading = true,
  batchSize = 20,
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore
}) => {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<Map<string, boolean>>(new Map());
  
  // Умное кэширование
  const { 
    get: getCachedData, 
    set: setCachedData, 
    preloadNextPage, 
    getStats,
    cacheSize 
  } = useSmartCache({
    maxSize: 200,
    ttl: 5 * 60 * 1000, // 5 минут
    preloadNext: true
  });
  
  // Определяем, нужна ли виртуализация (адаптивно)
  const getVirtualizationThreshold = useCallback(() => {
    // На мобильных устройствах порог ниже
    const isMobile = window.innerWidth < 768;
    return isMobile ? 50 : 100;
  }, []);

  const virtualizationThreshold = getVirtualizationThreshold();
  const shouldUseVirtualization = packs.length > virtualizationThreshold;

  // Показываем skeleton при пустом списке
  useEffect(() => {
    setShowSkeleton(packs.length === 0);
  }, [packs.length]);

  // Кэширование паков
  useEffect(() => {
    if (packs.length > 0) {
      const cacheKey = `packs_${packs.length}`;
      setCachedData(cacheKey, packs);
    }
  }, [packs, setCachedData]);

  // Предзагрузка следующей страницы
  useEffect(() => {
    if (hasNextPage && onLoadMore) {
      preloadNextPage(0, 1, async (page: number) => {
        // Здесь будет вызов API для загрузки следующей страницы
        console.log(`🔄 Предзагрузка страницы ${page + 1}...`);
        return [];
      });
    }
  }, [hasNextPage, onLoadMore, preloadNextPage]);

  // Отладочная информация о кэше
  useEffect(() => {
    const stats = getStats();
    console.log('📊 Статистика кэша:', {
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsage,
      cacheSize: cacheSize
    });
  }, [cacheSize, getStats]);



  // Infinite scroll для пагинации
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isLoadingMore && onLoadMore) {
          onLoadMore();
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isLoadingMore, onLoadMore]);

  // Ленивая загрузка при скролле (для локального отображения)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    // Если нет пагинации, используем локальную ленивую загрузку
    if (!hasNextPage && isNearBottom && visibleCount < packs.length) {
      setVisibleCount(prev => Math.min(prev + batchSize, packs.length));
    }
  }, [visibleCount, packs.length, batchSize, hasNextPage]);

  // Видимые паки - показываем все если есть пагинация
  const visiblePacks = useMemo(() => 
    hasNextPage ? packs : packs.slice(0, visibleCount), 
    [packs, visibleCount, hasNextPage]
  );


  // Обработчик клика
  const handlePackClick = useCallback((packId: string) => {
    if (onPackClick) {
      onPackClick(packId);
    }
  }, [onPackClick]);

  // Обработчик анимации лайка
  const handleLikeAnimation = useCallback((packId: string) => {
    setLikeAnimations(prev => new Map(prev.set(packId, true)));
    
    // Сброс анимации через 600ms
    setTimeout(() => {
      setLikeAnimations(prev => {
        const newMap = new Map(prev);
        newMap.delete(packId);
        return newMap;
      });
    }, 600);
  }, []);

  // Если нужно использовать виртуализацию
  if (shouldUseVirtualization) {
    return (
      <div style={{ width: '100%', height: '80vh' }}>
        
        <VirtualizedGallery
          packs={packs}
          onPackClick={onPackClick}
          itemHeight={200}
          containerHeight={600}
          overscan={6}
          hasNextPage={hasNextPage}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />
      </div>
    );
  }

  return (
    <div
      onScroll={handleScroll}
      style={{
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}
      data-testid="gallery-container"
    >


      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '8px',
        padding: '8px'
      }}>
        {/* Skeleton Loading */}
        {showSkeleton && (
          <>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                style={{
                  height: '200px',
                  width: '100%',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Имитация контента карточки */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60px',
                  height: '60px',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }} />
                
                {/* Имитация заголовка */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '8px',
                  right: '8px',
                  height: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  animation: 'pulse 2s infinite'
                }} />
              </div>
            ))}
          </>
        )}

        {/* Реальные карточки */}
        {!showSkeleton && visiblePacks.map((pack, index) => {
          const isLikeAnimating = likeAnimations.has(pack.id);
          
          return (
            <div
              key={pack.id}
              style={{
                position: 'relative'
              }}
            >
              {/* Анимация лайка */}
              {isLikeAnimating && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                    pointerEvents: 'none'
                  }}
                >
                  {/* Пульсация */}
                  <div
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(255, 0, 0, 0.3) 0%, transparent 70%)',
                      animation: 'likePulse 0.6s ease-out',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                  
                  {/* Частицы */}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '6px',
                        height: '6px',
                        backgroundColor: '#ff6b6b',
                        borderRadius: '50%',
                        animation: `particle-${i} 0.6s ease-out forwards`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                  
                  {/* Сердечко */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '24px',
                      animation: 'likeHeart 0.6s ease-out'
                    }}
                  >
                    ❤️
                  </div>
                </div>
              )}
              
          <PackCard
            pack={pack}
            isFirstRow={index < 2}
            isHighPriority={index < 6}
            onClick={handlePackClick}
          />
            </div>
          );
        })}
      </div>

      {/* Индикатор загрузки */}
      {!hasNextPage && visibleCount < packs.length && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
          color: 'var(--tg-theme-hint-color)'
        }}>
          Загружено {visibleCount} из {packs.length} паков
        </div>
      )}

      {/* Триггер для загрузки следующей страницы */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          style={{
            height: '20px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0'
          }}
        >
          {isLoadingMore && (
            <div style={{
              color: 'var(--tg-theme-hint-color)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--tg-theme-hint-color)',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Загрузка...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// CSS анимации только для skeleton loading и лайков
const skeletonStyles = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

/* Анимации для лайков */
@keyframes likePulse {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2);
    opacity: 0;
  }
}

@keyframes likeHeart {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(0deg);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2) rotate(10deg);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 0;
  }
}

/* Анимации частиц */
@keyframes particle-0 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(-30px, -30px) scale(0); opacity: 0; }
}

@keyframes particle-1 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(30px, -30px) scale(0); opacity: 0; }
}

@keyframes particle-2 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(-30px, 30px) scale(0); opacity: 0; }
}

@keyframes particle-3 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(30px, 30px) scale(0); opacity: 0; }
}

@keyframes particle-4 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(0, -40px) scale(0); opacity: 0; }
}

@keyframes particle-5 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(0, 40px) scale(0); opacity: 0; }
}

@keyframes particle-6 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(-40px, 0) scale(0); opacity: 0; }
}

@keyframes particle-7 {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(40px, 0) scale(0); opacity: 0; }
}
`;

// Добавляем стили в head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = skeletonStyles;
  document.head.appendChild(style);
}
