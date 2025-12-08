import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
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

// Константы для отступов
const GAP = 8; // Отступ между карточками
const HORIZONTAL_PADDING = 8; // Боковые отступы

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
  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 2;
    const width = window.innerWidth;
    return width < 600 ? 2 : 2; // Всегда 2 колонки для мобильных
  });

  // Обновляем количество колонок при изменении размера окна
  useEffect(() => {
    const updateColumnCount = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      const newCount = width < 600 ? 2 : 2;
      setColumnCount(newCount);
    };

    window.addEventListener('resize', updateColumnCount);
    updateColumnCount(); // Вызываем сразу для начального значения
    return () => window.removeEventListener('resize', updateColumnCount);
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
    // Ширина одной карточки = (ширина экрана - боковые отступы - gap между карточками) / количество колонок
    const cardWidth = (width - HORIZONTAL_PADDING * 2 - GAP * (columnCount - 1)) / columnCount;
    // Высота карточки по aspect ratio (1 / 1.618 означает высота = ширина * 1.618)
    const cardHeight = cardWidth * 1.618;
    // Высота строки = высота карточки + постоянный gap между строками
    return cardHeight + GAP;
  }, [columnCount]);

  // Виртуализация строк
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement || parentRef.current,
    estimateSize: estimateRowHeight,
    overscan: 3, // Рендерим 3 строки за пределами viewport
    // Включаем измерение для точной высоты с учетом aspect ratio карточек
    measureElement: (element) => {
      return element?.getBoundingClientRect().height ?? estimateRowHeight();
    },
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
      data-testid="gallery-container"
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
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                // Минимальная высота на основе оценки, но карточки могут её увеличить
                minHeight: `${virtualRow.size - GAP}px`,
                paddingBottom: `${GAP}px`, // Постоянный gap между строками через padding
                transform: `translateY(${virtualRow.start}px)`,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  gap: `${GAP}px`, // Gap для горизонтальных отступов между карточками в строке
                  padding: `0 ${HORIZONTAL_PADDING}px`,
                  alignContent: 'start',
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

