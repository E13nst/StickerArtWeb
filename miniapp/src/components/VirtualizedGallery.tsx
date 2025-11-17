import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { AnimatedPackCard } from './AnimatedPackCard';

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

export const VirtualizedGallery: React.FC<VirtualizedGalleryProps> = ({
  packs,
  onPackClick,
  itemHeight = 200,
  containerHeight = 600,
  overscan = 6,
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore,
  scrollContainerRef
}) => {
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

  // Вычисляем видимые элементы
  const visibleRange = useMemo(() => {
    const itemsPerRow = Math.floor(containerWidth / 140) || 3;
    const rowHeight = itemHeight + 8; // высота + gap
    const totalRows = Math.ceil(packs.length / itemsPerRow);
    
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.min(
      startRow + Math.ceil(measuredHeight / rowHeight) + overscan,
      totalRows
    );
    
    const startIndex = Math.max(0, startRow * itemsPerRow);
    const endIndex = Math.min(endRow * itemsPerRow, packs.length);
    
    return { startIndex, endIndex, itemsPerRow, totalRows };
  }, [scrollTop, packs.length, itemHeight, overscan, containerWidth, measuredHeight]);

  useEffect(() => {
    // Если scrollContainerRef равен null, используем скролл страницы
    if (!scrollContainerRef) {
      const handleScroll = () => {
        setScrollTop(window.scrollY || document.documentElement.scrollTop);
      };

      handleScroll();
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }

    const node = getContainerNode();
    if (!node) return;

    const handleScroll = () => setScrollTop(node.scrollTop);

    handleScroll();
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => node.removeEventListener('scroll', handleScroll);
  }, [getContainerNode, scrollContainerRef]);

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