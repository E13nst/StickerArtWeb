import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PackCard } from './PackCard';
import { VirtualizedGallery } from './VirtualizedGallery';
import { useSmartCache } from '../hooks/useSmartCache';
import { LoadingSpinner } from './LoadingSpinner';

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
  // Кнопка добавления как первый элемент сетки
  addButtonElement?: React.ReactNode;
  // Верхние элементы управления (поиск, фильтр)
  controlsElement?: React.ReactNode;
  // Спиннер во время обновления данных без скрытия панели
  isRefreshing?: boolean;
  includeUnpublished?: boolean;
}

export const SimpleGallery: React.FC<SimpleGalleryProps> = ({
  packs,
  onPackClick,
  enablePreloading = true,
  batchSize = 20,
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore,
  addButtonElement,
  controlsElement,
  isRefreshing = false,
  includeUnpublished = false
}) => {
  const dataPacks = useMemo(
    () => (includeUnpublished ? packs : packs.filter((pack) => pack.isPublic !== false)),
    [packs, includeUnpublished]
  );
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<Map<string, boolean>>(new Map());
  const [hideControls, setHideControls] = useState(false);
  
  // Случайные амплитуды для колонок (8-16px)
  const [floatAmplitudes] = useState(() => ({
    left: Math.floor(Math.random() * 9) + 8, // 8-16px
    right: Math.floor(Math.random() * 9) + 8 // 8-16px
  }));
  
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
  // ВАЖНО: Виртуализация определяется только при первой загрузке, чтобы избежать
  // переключения компонента во время пагинации (что вызывает потерю позиции скролла)
  const getVirtualizationThreshold = useCallback(() => {
    // На мобильных устройствах порог ниже
    const isMobile = window.innerWidth < 768;
    return isMobile ? 50 : 100;
  }, []);

  // Используем useRef для сохранения начального решения о виртуализации
  const virtualizationDecisionRef = useRef<boolean | null>(null);
  const lastPacksLengthRef = useRef<number>(0);
  
  // Инициализируем решение о виртуализации только один раз при первой загрузке
  // Или сбрасываем при полной перезагрузке (когда количество элементов резко уменьшается)
  useEffect(() => {
    // Если количество элементов резко уменьшилось (более чем на 50%), это полная перезагрузка
    const isFullReload = lastPacksLengthRef.current > 0 && 
                         dataPacks.length < lastPacksLengthRef.current * 0.5;
    
    if (isFullReload) {
      // Сбрасываем решение при полной перезагрузке
      virtualizationDecisionRef.current = null;
    }
    
    // Определяем виртуализацию только если решение еще не принято
    if (virtualizationDecisionRef.current === null && dataPacks.length > 0) {
      const virtualizationThreshold = getVirtualizationThreshold();
      virtualizationDecisionRef.current = dataPacks.length > virtualizationThreshold;
    }
    
    // Сохраняем текущее количество для следующей проверки
    lastPacksLengthRef.current = dataPacks.length;
  }, [dataPacks.length, getVirtualizationThreshold]);
  
  // Используем виртуализацию только если она была определена при первой загрузке
  // Если packs пустой, используем обычный режим
  const shouldUseVirtualization = virtualizationDecisionRef.current === true;

  // Показываем skeleton при пустом списке
  useEffect(() => {
    setShowSkeleton(dataPacks.length === 0);
  }, [dataPacks.length]);

  // Кэширование паков
  useEffect(() => {
    if (dataPacks.length > 0) {
      const cacheKey = `packs_${dataPacks.length}`;
      setCachedData(cacheKey, dataPacks);
    }
  }, [dataPacks, setCachedData]);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const lastScrollTopRef = useRef(0);

  // Сохраняем позицию скролла перед обновлением данных
  useEffect(() => {
    if (containerRef.current && isLoadingMore) {
      scrollPositionRef.current = containerRef.current.scrollTop;
    }
  }, [isLoadingMore]);

  // Восстанавливаем позицию скролла после загрузки
  useEffect(() => {
    if (containerRef.current && !isLoadingMore && scrollPositionRef.current > 0) {
      // Используем requestAnimationFrame для плавного восстановления
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  }, [isLoadingMore, dataPacks.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isLoadingMore && onLoadMore) {
          // Сохраняем позицию скролла перед загрузкой
          if (containerRef.current) {
            scrollPositionRef.current = containerRef.current.scrollTop;
          }
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

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const onScrollDirection = () => {
      const current = node.scrollTop;
      if (current > lastScrollTopRef.current && current > 40) {
        setHideControls(true);
      } else if (current < lastScrollTopRef.current) {
        setHideControls(false);
      }
      lastScrollTopRef.current = current;
    };

    node.addEventListener('scroll', onScrollDirection, { passive: true });

    return () => {
      node.removeEventListener('scroll', onScrollDirection);
    };
  }, []);

  // Ленивая загрузка при скролле (для локального отображения)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    // Если нет пагинации, используем локальную ленивую загрузку
    if (!hasNextPage && isNearBottom && visibleCount < dataPacks.length) {
      setVisibleCount(prev => Math.min(prev + batchSize, dataPacks.length));
    }
  }, [visibleCount, dataPacks.length, batchSize, hasNextPage]);

  // Видимые паки - показываем все если есть пагинация
  const visiblePacks = useMemo(() => 
    hasNextPage ? dataPacks : dataPacks.slice(0, visibleCount), 
    [dataPacks, visibleCount, hasNextPage]
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
  const renderOverlay = controlsElement || addButtonElement ? (
    <div className={`gallery-overlay ${hideControls ? 'hidden' : ''}`}>
      {controlsElement}
      {addButtonElement}
    </div>
  ) : null;

  if (shouldUseVirtualization) {
    return (
      <div
        ref={containerRef}
        className="gallery-scroll"
        data-testid="gallery-container"
        style={{ width: '100%', flex: '1 1 auto', minHeight: 0 }}
      >
        {renderOverlay}
        <div className="gallery-items">
          <VirtualizedGallery
            packs={dataPacks}
            onPackClick={onPackClick}
            itemHeight={200}
            containerHeight={600}
            overscan={6}
            hasNextPage={hasNextPage}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes floatColumn1 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-${floatAmplitudes.left}px); }
        }
        @keyframes floatColumn2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(${floatAmplitudes.right}px); }
        }
        .gallery-column-float-1 {
          animation: floatColumn1 6.18s ease-in-out infinite;
        }
        .gallery-column-float-2 {
          animation: floatColumn2 7.64s ease-in-out infinite;
          animation-delay: 1.18s;
        }
      `}</style>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="gallery-scroll"
        style={{
          width: '100%',
          flex: '1 1 auto',
          minHeight: 0,
          position: 'relative'
        }}
        data-testid="gallery-container"
      >
        {renderOverlay}
        {isRefreshing && <LoadingSpinner message="Обновление..." />}
        <div
          className="gallery-items"
          style={{
          display: 'flex',
          gap: '8px',
          padding: '0 calc(1rem * 0.382)',
          width: '100%',
          alignItems: 'flex-start'
        }}>
        {/* Левая колонка */}
        <div 
          className="gallery-column-float-1"
          style={{
            flex: '1 1 0%',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: 0,
            maxWidth: 'calc(50% - 4px)',
            boxSizing: 'border-box',
            overflow: 'visible'
          }}
        >
          {/* Skeleton Loading - левая колонка */}
          {showSkeleton && (
            <>
              {Array.from({ length: Math.ceil(6 / 2) }).map((_, index) => (
                <div
                  key={`skeleton-left-${index}`}
                  style={{
                    height: '200px',
                    width: '100%',
                    borderRadius: '12px',
                    background: `linear-gradient(90deg, var(--tg-theme-secondary-bg-color, #f0f0f0) 25%, var(--tg-theme-bg-color, #ffffff) 50%, var(--tg-theme-secondary-bg-color, #f0f0f0) 75%)`,
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
                    backgroundColor: 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
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
                    backgroundColor: 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
                    borderRadius: '8px',
                    animation: 'pulse 2s infinite'
                  }} />
                </div>
              ))}
            </>
          )}

          {/* Реальные карточки - левая колонка (четные индексы после кнопки) */}
          {!showSkeleton && visiblePacks.map((pack, index) => {
            // Распределяем карточки: после кнопки в левой колонке идут четные индексы (0, 2, 4...)
            // Но если есть кнопка, то индекс 0 идет в левую колонку как второй элемент
            const hasButton = !!addButtonElement;
            const shouldBeInLeftColumn = hasButton 
              ? (index % 2 === 0) // 0, 2, 4... в левую (после кнопки)
              : (index % 2 === 0); // 0, 2, 4... в левую
            
            if (!shouldBeInLeftColumn) return null;

            const isLikeAnimating = likeAnimations.has(pack.id);
            
            return (
              <div
                key={`left-${pack.id}-${index}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  willChange: 'transform',
                  transition: 'opacity 0.2s ease-in-out'
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
                    {/* Радиальная волна */}
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

        {/* Правая колонка */}
        <div 
          className="gallery-column-float-2"
          style={{
            flex: '1 1 0%',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: 0,
            maxWidth: 'calc(50% - 4px)',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        >
          {/* Skeleton Loading - правая колонка */}
          {showSkeleton && (
            <>
              {Array.from({ length: Math.floor(6 / 2) }).map((_, index) => (
                <div
                  key={`skeleton-right-${index}`}
                  style={{
                    height: '200px',
                    width: '100%',
                    borderRadius: '12px',
                    background: `linear-gradient(90deg, var(--tg-theme-secondary-bg-color, #f0f0f0) 25%, var(--tg-theme-bg-color, #ffffff) 50%, var(--tg-theme-secondary-bg-color, #f0f0f0) 75%)`,
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
                    backgroundColor: 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
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
                    backgroundColor: 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
                    borderRadius: '8px',
                    animation: 'pulse 2s infinite'
                  }} />
                </div>
              ))}
            </>
          )}

          {/* Реальные карточки - правая колонка (нечетные индексы) */}
          {!showSkeleton && visiblePacks.map((pack, index) => {
            // Правая колонка получает нечетные индексы (1, 3, 5...)
            // Это создаст эффект, что правая колонка начинается с первой карточки (index 1)
            const shouldBeInRightColumn = index % 2 === 1;
            
            if (!shouldBeInRightColumn) return null;

            const isLikeAnimating = likeAnimations.has(pack.id);
            
            return (
              <div
                key={`right-${pack.id}-${index}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  willChange: 'transform',
                  transition: 'opacity 0.2s ease-in-out'
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
                    {/* Радиальная волна */}
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
      </div>

      {/* Индикатор загрузки */}
      {!hasNextPage && visibleCount < dataPacks.length && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0',
          color: 'var(--tg-theme-hint-color)'
        }}>
          Загружено {visibleCount} из {dataPacks.length} паков
        </div>
      )}

      {/* Триггер для загрузки следующей страницы */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          style={{
            height: '1px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            margin: 0
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
    </>
  );
};

// CSS анимации для skeleton loading, лайков и люфта колонок
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
