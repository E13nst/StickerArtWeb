import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { OptimizedPackCard } from './OptimizedPackCard';
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
  isBlocked?: boolean;
  isDeleted?: boolean;
}

interface OptimizedGalleryProps {
  packs: Pack[];
  onPackClick?: (packId: string) => void;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  scrollElement?: HTMLElement | null;
}

export const OptimizedGallery: React.FC<OptimizedGalleryProps> = ({
  packs,
  onPackClick,
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore,
  scrollElement
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Вычисляем количество колонок на основе ширины
  const columnCount = useMemo(() => {
    if (typeof window === 'undefined') return 2;
    const width = window.innerWidth;
    return width < 600 ? 2 : 2; // Всегда 2 колонки для мобильных
  }, []);

  // Группируем элементы по строкам
  const rows = useMemo(() => {
    const result: Pack[][] = [];
    for (let i = 0; i < packs.length; i += columnCount) {
      result.push(packs.slice(i, i + columnCount));
    }
    return result;
  }, [packs, columnCount]);

  // Вычисляем примерную высоту карточки
  const estimateRowHeight = useCallback(() => {
    if (typeof window === 'undefined') return 200;
    const width = window.innerWidth;
    return (width / columnCount - 16) * 1.618; // -16 для gap и padding, *1.618 для aspect ratio
  }, [columnCount]);

  // Виртуализация строк
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement || parentRef.current,
    estimateSize: estimateRowHeight,
    overscan: 3, // Рендерим 3 строки за пределами viewport
  });

  // Infinite scroll через IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isLoadingMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: scrollElement || null,
        rootMargin: '400px',
        threshold: 0.1
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isLoadingMore, onLoadMore, scrollElement]);

  const handlePackClick = useCallback((packId: string) => {
    onPackClick?.(packId);
  }, [onPackClick]);

  return (
    <div
      ref={parentRef}
      style={{
        width: '100%',
        height: scrollElement ? 'auto' : '100vh',
        overflow: scrollElement ? 'visible' : 'auto',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  gap: '8px',
                  padding: '0 8px',
                  height: '100%',
                }}
              >
                {row.map((pack) => (
                  <OptimizedPackCard
                    key={pack.id}
                    pack={pack}
                    onClick={handlePackClick}
                  />
                ))}
                {/* Заполнитель для неполных строк */}
                {row.length < columnCount && (
                  <div style={{ width: '100%' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sentinel для infinite scroll */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          style={{
            height: '1px',
            width: '100%',
            position: 'absolute',
            bottom: 0,
          }}
        />
      )}

      {/* Индикатор загрузки */}
      {isLoadingMore && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '20px',
            position: 'sticky',
            bottom: 0,
          }}
        >
          <LoadingSpinner message="Загрузка..." />
        </div>
      )}
    </div>
  );
};

