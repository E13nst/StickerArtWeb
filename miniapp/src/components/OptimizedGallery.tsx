import { useRef, useMemo, useCallback, useEffect, useState, FC } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PackCard } from './PackCard';
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
  getLikesCount?: (packId: string) => number;
  onLikeClick?: (packId: string) => void;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  scrollElement?: HTMLElement | null;
  /** Figma ACCOUNT: карточки 177×213px */
  variant?: 'default' | 'account' | 'gallery';
}

// Константы для отступов
const GAP = 8; // Отступ между карточками
const HORIZONTAL_PADDING = 8; // Боковые отступы
/** Content_gallery Figma: 16px gap, 0 — боковые отступы в контейнере */
const GAP_GALLERY = 16;
const HORIZONTAL_PADDING_GALLERY = 0;

const CARD_WIDTH_ACCOUNT = 177;
const CARD_HEIGHT_ACCOUNT = 213;

export const OptimizedGallery: FC<OptimizedGalleryProps> = ({
  packs,
  onPackClick,
  getLikesCount: _getLikesCount,
  onLikeClick: _onLikeClick,
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore,
  scrollElement,
  variant = 'default'
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

  const isAccountVariant = variant === 'account' || variant === 'gallery';
  const isGalleryVariant = variant === 'gallery';
  const gap = isGalleryVariant ? GAP_GALLERY : GAP;
  const horizontalPadding = isGalleryVariant ? HORIZONTAL_PADDING_GALLERY : HORIZONTAL_PADDING;

  // Вычисляем примерную высоту карточки
  const estimateRowHeight = useCallback(() => {
    if (isAccountVariant) {
      return CARD_HEIGHT_ACCOUNT + gap;
    }
    if (typeof window === 'undefined') return 200;
    const width = window.innerWidth;
    const cardWidth = (width - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;
    const cardHeight = cardWidth * 1.618;
    return cardHeight + gap;
  }, [columnCount, variant, isAccountVariant, gap, horizontalPadding]);

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
      className={
        isGalleryVariant
          ? 'optimized-gallery optimized-gallery--account optimized-gallery--gallery'
          : isAccountVariant
            ? 'optimized-gallery optimized-gallery--account'
            : 'optimized-gallery'
      }
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
                minHeight: `${virtualRow.size - gap}px`,
                paddingBottom: `${gap}px`, // Постоянный gap между строками через padding
                transform: `translateY(${virtualRow.start}px)`,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isAccountVariant
                    ? `repeat(2, ${CARD_WIDTH_ACCOUNT}px)`
                    : `repeat(${columnCount}, 1fr)`,
                  gap: `${gap}px`,
                  padding: `0 ${horizontalPadding}px`,
                  alignContent: 'start',
                  justifyContent: isAccountVariant ? 'center' : undefined,
                }}
              >
                {row.map((pack) => (
                  <PackCard
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

