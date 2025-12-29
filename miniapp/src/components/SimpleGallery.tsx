import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { PackCard } from './PackCard';
import { VirtualizedGallery } from './VirtualizedGallery';
import { useSmartCache } from '../hooks/useSmartCache';
import { LoadingSpinner } from './LoadingSpinner';
import { throttle } from '../utils/throttle';

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
  // Информация о типах файлов в сете для отладки (видна только админу)
  stickerTypes?: {
    hasWebp: boolean;
    hasWebm: boolean;
    hasTgs: boolean;
  };
  // Количество стикеров в паке (видно только админу)
  stickerCount?: number;
  // Публичность стикерсета
  isPublic?: boolean;
  // Флаги блокировки и удаления
  isBlocked?: boolean;
  isDeleted?: boolean;
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
  // Использовать скролл страницы вместо собственного скролла галереи
  usePageScroll?: boolean;
  // Режим скролла: 'inner' - внутренний скролл галереи, 'page' - скролл всей страницы
  scrollMode?: 'inner' | 'page';
  // Пустое состояние (отображается внутри галереи когда packs пустой)
  emptyState?: React.ReactNode;
  // Внешний scroll-элемент для использования вместо window (для единого scroll-контейнера)
  externalScrollElement?: HTMLElement | null;
  // Нужен ли отступ сверху для fixed CompactControlsBar (только для GalleryPage)
  needsControlsBarOffset?: boolean;
}

const SimpleGalleryComponent: React.FC<SimpleGalleryProps> = ({
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
  usePageScroll = false,
  scrollMode,
  emptyState,
  externalScrollElement,
  needsControlsBarOffset = false
}) => {
  // Определяем режим скролла: приоритет у scrollMode, затем usePageScroll для обратной совместимости
  const isPageScroll = scrollMode === 'page' || (scrollMode === undefined && usePageScroll);
  // Используем externalScrollElement если передан, иначе window для page scroll или containerRef для inner
  const scrollElement = isPageScroll ? (externalScrollElement || null) : null;
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
  
  // 🔥 ОПТИМИЗАЦИЯ: Виртуализация по умолчанию для всех элементов
  // Используем VirtualizedGallery всегда, когда есть элементы
  // Это снижает количество DOM-узлов и активных анимаций
  // ВАЖНО: Виртуализация определяется только при первой загрузке, чтобы избежать
  // переключения компонента во время пагинации (что вызывает потерю позиции скролла)
  const virtualizationDecisionRef = useRef<boolean | null>(null);
  const lastPacksLengthRef = useRef<number>(0);
  
  // Инициализируем решение о виртуализации только один раз при первой загрузке
  // Или сбрасываем при полной перезагрузке (когда количество элементов резко уменьшается)
  useEffect(() => {
    // Если количество элементов резко уменьшилось (более чем на 50%), это полная перезагрузка
    const isFullReload = lastPacksLengthRef.current > 0 && 
                         packs.length < lastPacksLengthRef.current * 0.5;
    
    if (isFullReload) {
      // Сбрасываем решение при полной перезагрузке
      virtualizationDecisionRef.current = null;
    }
    
    // 🔥 ИЗМЕНЕНО: Используем виртуализацию для большого количества элементов
    // Для небольшого количества (< 30) виртуализация может мешать пагинации
    if (virtualizationDecisionRef.current === null && packs.length > 0) {
      // Используем виртуализацию только если элементов достаточно много
      // Это позволяет пагинации работать корректно для первых страниц
      virtualizationDecisionRef.current = packs.length >= 30;
    }
    
    // Сохраняем текущее количество для следующей проверки
    lastPacksLengthRef.current = packs.length;
  }, [packs.length]);
  
  // Используем виртуализацию только для большого количества элементов
  // Это позволяет пагинации работать корректно для первых страниц
  const shouldUseVirtualization = virtualizationDecisionRef.current === true;

  // Показываем skeleton только при пустом списке, если нет emptyState
  // Если есть emptyState, skeleton не показываем (будем показывать emptyState)
  useEffect(() => {
    // Skeleton показываем только если:
    // 1. packs пустой
    // 2. Нет emptyState (если есть emptyState, показываем его вместо skeleton)
    setShowSkeleton(packs.length === 0 && !emptyState);
  }, [packs.length, emptyState]);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const lastScrollTopRef = useRef(0);

  // Сохраняем позицию скролла перед обновлением данных
  useEffect(() => {
    if (isLoadingMore) {
      if (isPageScroll) {
        if (scrollElement) {
          scrollPositionRef.current = scrollElement.scrollTop;
        } else {
          scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
        }
      } else if (containerRef.current) {
        scrollPositionRef.current = containerRef.current.scrollTop;
      }
    }
  }, [isLoadingMore, isPageScroll, scrollElement]);

  // Восстанавливаем позицию скролла после загрузки
  useEffect(() => {
    if (!isLoadingMore && scrollPositionRef.current > 0) {
      // Используем requestAnimationFrame для плавного восстановления
      requestAnimationFrame(() => {
        if (isPageScroll) {
          if (scrollElement) {
            scrollElement.scrollTo(0, scrollPositionRef.current);
          } else {
            window.scrollTo(0, scrollPositionRef.current);
          }
        } else if (containerRef.current) {
          containerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  }, [isLoadingMore, packs.length, isPageScroll, scrollElement]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !hasNextPage || isLoadingMore) {
      if (!sentinel) console.log('🔍 InfiniteScroll: sentinel не найден');
      if (!hasNextPage) console.log('🔍 InfiniteScroll: нет следующей страницы');
      if (isLoadingMore) console.log('🔍 InfiniteScroll: уже загружается');
      return;
    }

    // Если используем скролл страницы, используем scrollElement или null (window) как root
    // null означает, что используется viewport как root для IntersectionObserver
    const rootElement = isPageScroll ? (scrollElement || null) : container;

    console.log('🔍 InfiniteScroll: настройка IntersectionObserver', {
      hasNextPage,
      isLoadingMore,
      isPageScroll,
      containerHeight: container?.clientHeight,
      containerScrollHeight: container?.scrollHeight
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        console.log('🔍 InfiniteScroll: IntersectionObserver callback', {
          isIntersecting: entry.isIntersecting,
          intersectionRatio: entry.intersectionRatio,
          hasNextPage,
          isLoadingMore
        });
        if (entry.isIntersecting && hasNextPage && !isLoadingMore && onLoadMore) {
          console.log('✅ InfiniteScroll: загрузка следующей страницы');
          // Сохраняем позицию скролла перед загрузкой
          if (isPageScroll) {
            if (scrollElement) {
              scrollPositionRef.current = scrollElement.scrollTop;
            } else {
              scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
            }
          } else if (containerRef.current) {
            scrollPositionRef.current = containerRef.current.scrollTop;
          }
          onLoadMore();
        }
      },
      {
        root: rootElement, // null для window, или container для внутреннего скролла
        rootMargin: isPageScroll ? '400px' : '200px', // ✅ Увеличен для page scroll режима, чтобы sentinel был виден раньше
        threshold: 0.1
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isLoadingMore, onLoadMore, isPageScroll, scrollElement]);

  // ✅ P1 OPTIMIZATION: Throttle scroll handler для лучшего FPS
  // Создаем throttled функцию один раз через useMemo
  const throttledScrollHandler = useMemo(
    () => throttle((currentScroll: number) => {
      if (currentScroll > lastScrollTopRef.current && currentScroll > 40) {
        setHideControls(true);
      } else if (currentScroll < lastScrollTopRef.current) {
        setHideControls(false);
      }
      lastScrollTopRef.current = currentScroll;
    }, 100), // Max 10 раз в секунду вместо 60+
    []
  );

  useEffect(() => {
    if (isPageScroll) {
      // Используем скролл страницы (scrollElement или window)
      if (!scrollElement) {
        // Fallback на window если scrollElement не передан
        const onScrollDirection = () => {
          const current = window.scrollY || document.documentElement.scrollTop;
          throttledScrollHandler(current);
        };

        window.addEventListener('scroll', onScrollDirection, { passive: true });

        return () => {
          window.removeEventListener('scroll', onScrollDirection);
          throttledScrollHandler.cancel();
        };
      } else {
        // Используем scrollElement
        const onScrollDirection = () => {
          const current = scrollElement.scrollTop;
          throttledScrollHandler(current);
        };

        scrollElement.addEventListener('scroll', onScrollDirection, { passive: true });

        return () => {
          scrollElement.removeEventListener('scroll', onScrollDirection);
          throttledScrollHandler.cancel();
        };
      }
    } else {
      // Используем скролл контейнера
      const node = containerRef.current;
      if (!node) {
        return;
      }

      const onScrollDirection = () => {
        const current = node.scrollTop;
        throttledScrollHandler(current);
      };

      node.addEventListener('scroll', onScrollDirection, { passive: true });

      return () => {
        node.removeEventListener('scroll', onScrollDirection);
        throttledScrollHandler.cancel(); // Важно: очищаем throttle при unmount
      };
    }
  }, [isPageScroll, throttledScrollHandler, scrollElement]);

  // Ленивая загрузка при скролле (для локального отображения)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isPageScroll) {
      // При использовании скролла страницы эта функция не вызывается
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    // Если нет пагинации, используем локальную ленивую загрузку
    if (!hasNextPage && isNearBottom && visibleCount < packs.length) {
      setVisibleCount(prev => Math.min(prev + batchSize, packs.length));
    }
  }, [visibleCount, packs.length, batchSize, hasNextPage, isPageScroll]);

  // Видимые паки - показываем все если есть пагинация (onLoadMore) или hasNextPage
  // Локальная ленивая загрузка используется только если нет пагинации вообще
  const visiblePacks = useMemo(() => {
    // Если есть onLoadMore, значит используется пагинация - показываем все загруженные паки
    if (onLoadMore) {
      return packs;
    }
    // Если нет пагинации, используем локальную ленивую загрузку
    return packs.slice(0, visibleCount);
  }, [packs, visibleCount, onLoadMore]);


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

  // Проверяем, нужно ли показать пустое состояние
  // Показываем emptyState, если:
  // 1. emptyState передан
  // 2. packs пустой
  // 3. Не показываем skeleton (skeleton имеет приоритет при загрузке)
  const showEmptyState = emptyState && packs.length === 0 && !showSkeleton;

  if (shouldUseVirtualization) {
    return (
      <>
        <style>{`
          .gallery-scroll {
            overflow-y: auto;
            overflow-x: hidden;
            max-height: 100vh;
            -webkit-overflow-scrolling: touch;
          }
        `}</style>
        <div className="stixly-content-600">
          <div
            ref={containerRef}
            className={isPageScroll ? "simpleGallery simpleGallery--pageScroll" : "simpleGallery simpleGallery--innerScroll gallery-scroll"}
            data-testid="gallery-container"
            style={{ 
              width: '100%', 
              flex: '1 1 auto', 
              minHeight: 0,
              ...(isPageScroll ? {} : {})
            }}
          >
        {renderOverlay}
        {isRefreshing && <LoadingSpinner message="Обновление..." />}
        {showEmptyState ? (
          emptyState
        ) : (
          <div className="gallery-items">
            <VirtualizedGallery
              packs={packs}
              onPackClick={onPackClick}
              itemHeight={200}
              overscan={3}
              hasNextPage={hasNextPage}
              isLoadingMore={isLoadingMore}
              onLoadMore={onLoadMore}
              scrollContainerRef={isPageScroll ? undefined : containerRef}
            />
          </div>
        )}
          </div>
        </div>
    </>
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
        .gallery-scroll {
          overflow-y: auto;
          overflow-x: hidden;
          max-height: 100vh;
          -webkit-overflow-scrolling: touch;
        }
        .simpleGallery--innerScroll {
          overflow-y: auto;
          overflow-x: hidden;
          max-height: 100vh;
          -webkit-overflow-scrolling: touch;
        }
        .simpleGallery--pageScroll {
          overflow: visible;
          height: auto;
          max-height: none;
        }
      `}</style>
      <div className="stixly-content-600">
        <div
          ref={containerRef}
          onScroll={isPageScroll ? undefined : handleScroll}
          className={isPageScroll ? "simpleGallery simpleGallery--pageScroll" : "simpleGallery simpleGallery--innerScroll gallery-scroll"}
          style={{
            width: '100%',
            flex: '1 1 auto',
            minHeight: 0,
            position: 'relative',
            // Add padding top for fixed header (140px) + controls bar (~60px) = 200px
            paddingTop: isPageScroll ? undefined : '200px'
          }}
          data-testid="gallery-container"
        >
        {renderOverlay}
        {isRefreshing && <LoadingSpinner message="Обновление..." />}
        {showEmptyState ? (
          emptyState
        ) : (
          <div
            className="gallery-items"
            style={{
            display: 'flex',
            gap: '8px',
            padding: '0 calc(1rem * 0.382)',
            // Отступ сверху для page scroll: учитываем высоту fixed CompactControlsBar (~56px) только если нужен
            // controlsElement отсутствует, так как CompactControlsBar рендерится вне SimpleGallery
            paddingTop: isPageScroll && needsControlsBarOffset && !controlsElement ? '56px' : (
              controlsElement 
                ? '0' 
                : (addButtonElement 
                    ? '2.2rem' 
                    : (isPageScroll ? '0' : '2.2rem'))
            ),
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
                  onClick={handlePackClick}
                />
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* Индикатор загрузки - показываем только при локальной ленивой загрузке (без пагинации) */}
      {!showEmptyState && !onLoadMore && !hasNextPage && visibleCount < packs.length && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0',
          color: 'var(--tg-theme-hint-color)'
        }}>
          Загружено {visibleCount} из {packs.length} паков
        </div>
      )}

      {/* Триггер для загрузки следующей страницы */}
      {!showEmptyState && hasNextPage && (
        <div
          ref={sentinelRef}
          style={{
            height: '20px',
            minHeight: '20px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 0',
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

// Кастомная функция сравнения для оптимизации memo
const areGalleryPropsEqual = (prevProps: SimpleGalleryProps, nextProps: SimpleGalleryProps): boolean => {
  // Проверка массива packs (самое критичное)
  if (prevProps.packs.length !== nextProps.packs.length) {
    return false;
  }
  
  // Быстрая проверка ID первого и последнего пака
  if (prevProps.packs.length > 0) {
    if (prevProps.packs[0].id !== nextProps.packs[0].id ||
        prevProps.packs[prevProps.packs.length - 1].id !== nextProps.packs[nextProps.packs.length - 1].id) {
      return false;
    }
  }
  
  // Проверка флагов загрузки
  if (prevProps.isLoadingMore !== nextProps.isLoadingMore ||
      prevProps.isRefreshing !== nextProps.isRefreshing ||
      prevProps.hasNextPage !== nextProps.hasNextPage) {
    return false;
  }
  
  // Проверка callbacks (обычно стабильны через useCallback)
  if (prevProps.onPackClick !== nextProps.onPackClick ||
      prevProps.onLoadMore !== nextProps.onLoadMore) {
    return false;
  }
  
  // Проверка настроек
  if (prevProps.enablePreloading !== nextProps.enablePreloading ||
      prevProps.batchSize !== nextProps.batchSize ||
      prevProps.usePageScroll !== nextProps.usePageScroll ||
      prevProps.scrollMode !== nextProps.scrollMode) {
    return false;
  }
  
  // React элементы проверяем по reference
  if (prevProps.addButtonElement !== nextProps.addButtonElement ||
      prevProps.controlsElement !== nextProps.controlsElement) {
    return false;
  }
  
  // Если всё совпало — не перерисовываем
  return true;
};

export const SimpleGallery = memo(SimpleGalleryComponent, areGalleryPropsEqual);
