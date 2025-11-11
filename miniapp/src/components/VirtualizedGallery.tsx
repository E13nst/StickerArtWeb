import React, { useMemo, useRef, useState, useEffect } from 'react';
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
  isPublic?: boolean;
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
}

export const VirtualizedGallery: React.FC<VirtualizedGalleryProps> = ({
  packs,
  onPackClick,
  itemHeight = 200,
  containerHeight = 600,
  overscan = 6,
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(400);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Обновление ширины контейнера
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Вычисляем видимые элементы
  const visibleRange = useMemo(() => {
    const itemsPerRow = Math.floor(containerWidth / 140) || 3;
    const rowHeight = itemHeight + 8; // высота + gap
    const totalRows = Math.ceil(packs.length / itemsPerRow);
    
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.min(
      startRow + Math.ceil(containerHeight / rowHeight) + overscan,
      totalRows
    );
    
    const startIndex = Math.max(0, startRow * itemsPerRow);
    const endIndex = Math.min(endRow * itemsPerRow, packs.length);
    
    return { startIndex, endIndex, itemsPerRow, totalRows };
  }, [scrollTop, packs.length, itemHeight, containerHeight, overscan, containerWidth]);

  // Обработчик скролла
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Пагинация: sentinel внутри scroll-контейнера
  useEffect(() => {
    const root = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasNextPage || isLoadingMore) return;

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
  }, [hasNextPage, isLoadingMore, onLoadMore]);

  // Рендерим только видимые элементы
  const visiblePacks = packs.slice(visibleRange.startIndex, visibleRange.endIndex);
  const offsetY = Math.floor(visibleRange.startIndex / visibleRange.itemsPerRow) * (itemHeight + 8);

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflow: 'auto',
        width: '100%',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      {/* Общая высота для правильного скролла */}
      <div style={{ 
        height: visibleRange.totalRows * (itemHeight + 8),
        position: 'relative'
      }}>
        {/* Видимые элементы */}
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

      {/* Индикатор отключен в прод-сборке */}
    </div>
  );
};