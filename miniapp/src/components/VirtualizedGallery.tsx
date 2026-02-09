import { useMemo, useRef, useState, useEffect, useCallback, FC } from 'react';
import { AnimatedPackCard } from './AnimatedPackCard';
import { useScrollElement } from '../contexts/ScrollContext';

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
}

interface VirtualizedGalleryProps {
  packs: Pack[];
  onPackClick?: (packId: string) => void;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number; // Сколько элементов рендерить за пределами видимой области
  // Пагинация
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

export const VirtualizedGallery: FC<VirtualizedGalleryProps> = ({
  packs,
  onPackClick,
  itemHeight = 200,
  containerHeight = 600,
  overscan = 3, // 🔥 ОПТИМИЗАЦИЯ: Уменьшен с 6 до 3 для баланса между производительностью и видимостью элементов
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore,
  scrollContainerRef
}) => {
  const scrollElement = useScrollElement();
  const localContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(400);
  const [measuredHeight, setMeasuredHeight] = useState(containerHeight);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const getContainerNode = useCallback(() => {
    return scrollContainerRef?.current ?? localContainerRef.current;
  }, [scrollContainerRef]);

  // Обновление ширины контейнера
  useEffect(() => {
    // Если scrollContainerRef равен null, используем window для измерения
    if (!scrollContainerRef) {
      const updateMetrics = () => {
        setContainerWidth(window.innerWidth || 400);
        setMeasuredHeight(window.innerHeight || containerHeight);
      };

      updateMetrics();
      window.addEventListener('resize', updateMetrics);
      return () => window.removeEventListener('resize', updateMetrics);
    }

    const node = getContainerNode();
    if (!node) return;

    const updateMetrics = () => {
      setContainerWidth(node.clientWidth || 400);
      setMeasuredHeight(node.clientHeight || containerHeight);
    };

    updateMetrics();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateMetrics);
      ro.observe(node);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', updateMetrics);
    return () => window.removeEventListener('resize', updateMetrics);
  }, [containerHeight, getContainerNode, scrollContainerRef]);

  // 🔥 ОПТИМИЗИРОВАННЫЙ расчет видимых элементов
  const visibleRange = useMemo(() => {
    // Динамически вычисляем количество элементов в строке на основе ширины контейнера
    // Для двухколоночной сетки обычно получается 2, но учитываем разные размеры экрана
    const itemsPerRow = Math.floor(containerWidth / 140) || 2; // Минимум 2 колонки
    const rowHeight = itemHeight + 8; // высота + gap
    const totalRows = Math.ceil(packs.length / itemsPerRow);
    
    // Вычисляем количество видимых строк (с учетом высоты контейнера)
    const visibleRows = Math.ceil(measuredHeight / rowHeight);
    
    // Вычисляем видимые строки с учетом overscan
    // Убеждаемся, что overscan применяется правильно для предзагрузки
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - Math.max(1, Math.floor(overscan / 2)));
    const endRow = Math.min(
      startRow + visibleRows + overscan * 2, // Увеличиваем overscan для лучшего покрытия
      totalRows
    );
    
    // Вычисляем индексы элементов с учетом количества колонок
    const startIndex = Math.max(0, startRow * itemsPerRow);
    const endIndex = Math.min(endRow * itemsPerRow, packs.length);
    
    return { startIndex, endIndex, itemsPerRow, totalRows };
  }, [scrollTop, packs.length, itemHeight, overscan, containerWidth, measuredHeight]);

  useEffect(() => {
    // Используем scrollElement из контекста, если доступен, иначе scrollContainerRef, иначе window
    const targetElement = scrollElement || getContainerNode() || null;
    
    if (!targetElement) {
      // Fallback на window если нет scrollElement и scrollContainerRef
      const handleScroll = () => {
        setScrollTop(window.scrollY || document.documentElement.scrollTop);
      };

      handleScroll();
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }

    const handleScroll = () => setScrollTop(targetElement.scrollTop);

    handleScroll();
    targetElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => targetElement.removeEventListener('scroll', handleScroll);
  }, [getContainerNode, scrollContainerRef, scrollElement]);

  // Пагинация: sentinel внутри scroll-контейнера
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isLoadingMore) return;

    // Если scrollContainerRef равен null, используем window как root
    const root = scrollContainerRef ? getContainerNode() : null;

    const io = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isLoadingMore && onLoadMore) {
          onLoadMore();
        }
      },
      { root, rootMargin: '120px', threshold: 0.1 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [getContainerNode, hasNextPage, isLoadingMore, onLoadMore, scrollContainerRef]);

  // Рендерим только видимые элементы
  const visiblePacks = packs.slice(visibleRange.startIndex, visibleRange.endIndex);
  const offsetY = Math.floor(visibleRange.startIndex / visibleRange.itemsPerRow) * (itemHeight + 8);

  const content = (
    <div style={{ 
      height: visibleRange.totalRows * (itemHeight + 8),
      position: 'relative'
    }}>
      <div
        style={{
          position: 'absolute',
          top: offsetY,
          left: 0,
          right: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${visibleRange.itemsPerRow}, 1fr)`,
          gap: '8px',
          padding: '8px'
        }}
      >
        {visiblePacks.map((pack, index) => (
          <AnimatedPackCard
            key={pack.id}
            pack={pack}
            isHighPriority={visibleRange.startIndex + index < 6}
            onClick={onPackClick}
            delay={index * 50} // Поочередное появление
          />
        ))}
      </div>
      {hasNextPage && (
        <div ref={sentinelRef} style={{ position: 'absolute', bottom: 0, height: 1, width: '100%' }} />
      )}
    </div>
  );

  // Если scrollContainerRef передан, используем его (внешний контейнер)
  // Если scrollContainerRef равен null, используем скролл страницы (не создаем контейнер)
  // Если scrollContainerRef не передан, создаем свой контейнер со скроллом
  if (scrollContainerRef !== undefined) {
    return content;
  }

  return (
    <div
      ref={localContainerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
        width: '100%',
        position: 'relative'
      }}
    >
      {content}
    </div>
  );
};