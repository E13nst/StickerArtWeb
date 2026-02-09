import { useEffect, useRef, useState, useCallback, memo, FC } from 'react';
import { SearchBar } from './SearchBar';
import { CategoryFilter, Category } from './CategoryFilter';
import { SortButton } from './SortButton';
import { AddStickerPackButton } from './AddStickerPackButton';
import { StickerTypeFilter } from './StickerTypeFilter';
import { DateFilter } from './DateFilter';
import { TuneIcon } from '@/components/ui/Icons';;
import { SearchIcon } from '@/components/ui/Icons';;
import { throttle } from '../utils/throttle';
import { useTelegram } from '../hooks/useTelegram';
import { useScrollElement } from '../contexts/ScrollContext';

type FilterMode = null | 'stickerType' | 'dateAdded';

interface GalleryControlsBarProps {
  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearch: (value: string) => void;
  searchDisabled?: boolean;
  
  // Categories
  categories: Category[];
  selectedCategories: string[];
  onCategoryToggle: (categoryId: string) => void;
  categoriesDisabled?: boolean;
  
  // Sort
  sortByLikes: boolean;
  onSortToggle: () => void;
  sortDisabled?: boolean;
  
  // Sticker Type Filter
  selectedStickerTypes: string[];
  onStickerTypeToggle: (typeId: string) => void;
  
  // Date Filter
  selectedDate: string | null;
  onDateChange: (dateId: string) => void;
  
  // Add button
  onAddClick: () => void;
  
  // Scroll behavior
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

const GalleryControlsBarComponent: FC<GalleryControlsBarProps> = ({
  searchValue,
  onSearchChange,
  onSearch,
  searchDisabled = false,
  categories,
  selectedCategories,
  onCategoryToggle,
  categoriesDisabled = false,
  sortByLikes,
  onSortToggle,
  sortDisabled = false,
  selectedStickerTypes,
  onStickerTypeToggle,
  selectedDate,
  onDateChange,
  onAddClick,
  scrollContainerRef: _scrollContainerRef,
}) => {
  const { tg } = useTelegram();
  const scrollElement = useScrollElement();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;
  
  const [isHidden, setIsHidden] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>(null);
  const lastScrollTopRef = useRef(0);
  const controlsBarRef = useRef<HTMLDivElement>(null);

  // Glass effect colors
  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.28)' : 'rgba(88, 138, 255, 0.20)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.42)' : 'rgba(78, 132, 255, 0.20)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.38)' : 'rgba(98, 150, 255, 0.34)';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.52)' : 'rgba(118, 168, 255, 0.24)';
  const bgColor = isLight ? 'rgba(248, 251, 255, 0.95)' : 'rgba(18, 22, 29, 0.95)';

  // Throttled scroll handler
  const throttledScrollHandler = useCallback(
    throttle((currentScroll: number) => {
      const scrollThreshold = 40;
      
      if (currentScroll > lastScrollTopRef.current && currentScroll > scrollThreshold) {
        setIsHidden(true);
      } else if (currentScroll < lastScrollTopRef.current) {
        setIsHidden(false);
      }
      
      lastScrollTopRef.current = currentScroll;
    }, 100),
    []
  );

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = scrollElement 
        ? scrollElement.scrollTop 
        : (window.scrollY || document.documentElement.scrollTop);
      throttledScrollHandler(currentScroll);
    };

    const targetElement = scrollElement || window;
    targetElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      targetElement.removeEventListener('scroll', handleScroll);
      throttledScrollHandler.cancel();
    };
  }, [throttledScrollHandler, scrollElement]);

  const handleFilterClick = () => {
    tg?.HapticFeedback?.impactOccurred('light');
    
    // Cycle through filter modes: null -> stickerType -> dateAdded -> null
    if (filterMode === null) {
      setFilterMode('stickerType');
    } else if (filterMode === 'stickerType') {
      setFilterMode('dateAdded');
    } else {
      setFilterMode(null);
    }
  };
  
  // Get filter button label based on current mode
  const getFilterLabel = (): string | null => {
    if (filterMode === 'stickerType') return 'Тип стикера';
    if (filterMode === 'dateAdded') return 'Дата добавления';
    return null;
  };
  
  const filterLabel = getFilterLabel();
  const isFilterActive = filterMode !== null;

  return (
    <div
      ref={controlsBarRef}
      className={`gallery-controls-bar ${isHidden ? 'gallery-controls-bar--hidden' : ''}`}
      style={{
        position: 'fixed',
        top: 'var(--stixly-header-height)',
        left: '50%',
        right: 'auto',
        width: '100%',
        maxWidth: '600px', // узкий лейаут для основного контента
        transform: isHidden ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        transition: 'transform 0.3s ease-out',
        zIndex: 'var(--z-ui-controls, 200)',
        backgroundColor: bgColor,
        backdropFilter: 'blur(12px) saturate(150%)',
        WebkitBackdropFilter: 'blur(12px) saturate(150%)',
        borderBottom: `1px solid ${borderColor}`,
        padding: '0.5rem 0.618rem',
        boxShadow: isLight 
          ? '0 2px 8px rgba(30, 72, 185, 0.08)' 
          : '0 2px 8px rgba(0, 0, 0, 0.24)',
      }}
    >
      {/* Top row: Search + Filter + Sort */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        {/* Search Bar or Icon - collapses to icon when filter is active */}
        <div 
          style={{ 
            flex: isFilterActive ? '0 0 auto' : '1 1 auto',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: isFilterActive ? '2.2rem' : '0',
          }}
        >
          {isFilterActive ? (
            <button
              onClick={() => {
                // When clicked, deactivate filter to show search
                setFilterMode(null);
              }}
              aria-label="Поиск"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 0.65rem',
                borderRadius: '0.75rem',
                background: glassBase,
                backgroundColor: glassSolid,
                color: textColorResolved,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                border: `1px solid ${borderColor}`,
                boxShadow: isLight 
                  ? '0 4px 12px rgba(30, 72, 185, 0.10)' 
                  : '0 4px 12px rgba(28, 48, 108, 0.20)',
                height: '2.2rem',
                minWidth: '2.2rem',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, {
                  background: glassHover,
                  backgroundColor: glassHover,
                  transform: 'scale(0.98)',
                });
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, {
                  background: glassBase,
                  backgroundColor: glassSolid,
                  transform: 'scale(1)',
                });
              }}
            >
              <SearchIcon style={{ fontSize: '1rem' }} />
            </button>
          ) : (
            <SearchBar
              value={searchValue}
              onChange={onSearchChange}
              onSearch={onSearch}
              placeholder="Поиск стикеров..."
              disabled={searchDisabled}
              compact={true}
            />
          )}
        </div>

        {/* Filter Button - expands with text when active */}
        <button
          onClick={handleFilterClick}
          aria-label={filterLabel || "Фильтры"}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: filterLabel ? '0 0.75rem' : '0 0.65rem',
            borderRadius: '0.75rem',
            background: isFilterActive ? glassHover : glassBase,
            backgroundColor: isFilterActive ? glassHover : glassSolid,
            color: textColorResolved,
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 500,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            outline: 'none',
            border: `1px solid ${borderColor}`,
            boxShadow: isLight 
              ? '0 4px 12px rgba(30, 72, 185, 0.10)' 
              : '0 4px 12px rgba(28, 48, 108, 0.20)',
            height: '2.2rem',
            minWidth: '2.2rem',
            maxWidth: filterLabel ? '100%' : '2.2rem',
            width: filterLabel ? 'auto' : '2.2rem',
            userSelect: 'none',
            gap: '0.42rem',
            transform: isFilterActive ? 'scale(0.98)' : 'scale(1)',
            flex: filterLabel ? '1 1 auto' : '0 0 auto',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, {
              background: glassHover,
              backgroundColor: glassHover,
              transform: 'scale(0.98)',
            });
          }}
          onMouseLeave={(e) => {
            Object.assign(e.currentTarget.style, {
              background: isFilterActive ? glassHover : glassBase,
              backgroundColor: isFilterActive ? glassHover : glassSolid,
              transform: isFilterActive ? 'scale(0.98)' : 'scale(1)',
            });
          }}
        >
          <TuneIcon style={{ fontSize: '1rem', flexShrink: 0 }} />
          <span 
            style={{
              opacity: filterLabel ? 1 : 0,
              maxWidth: filterLabel ? '200px' : '0px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {filterLabel || 'Фильтры'}
          </span>
        </button>

        {/* Sort Button - always shows text */}
        <SortButton
          sortByLikes={sortByLikes}
          onToggle={onSortToggle}
          disabled={sortDisabled}
        />
      </div>

      {/* Filter content row - shows different content based on filter mode */}
      <div 
        style={{ 
          marginBottom: '0.5rem',
        }}
      >
        <div
          key={filterMode || 'categories'}
          style={{
            animation: 'fadeSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {filterMode === 'stickerType' ? (
            <StickerTypeFilter
              selectedTypes={selectedStickerTypes}
              onTypeToggle={onStickerTypeToggle}
              disabled={false}
              compact={true}
            />
          ) : filterMode === 'dateAdded' ? (
            <DateFilter
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              disabled={false}
              compact={true}
            />
          ) : categories.length > 0 ? (
            <CategoryFilter
              categories={categories}
              selectedCategories={selectedCategories}
              onCategoryToggle={onCategoryToggle}
              disabled={categoriesDisabled}
              compact={true}
            />
          ) : null}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Add button */}
      <div style={{ marginBottom: '0' }}>
        <AddStickerPackButton
          variant="gallery"
          onClick={onAddClick}
        />
      </div>
    </div>
  );
};

// Мемоизация для предотвращения лишних перерисовок
const arePropsEqual = (
  prevProps: GalleryControlsBarProps,
  nextProps: GalleryControlsBarProps
): boolean => {
  // Проверяем простые значения
  if (
    prevProps.searchValue !== nextProps.searchValue ||
    prevProps.searchDisabled !== nextProps.searchDisabled ||
    prevProps.sortByLikes !== nextProps.sortByLikes ||
    prevProps.sortDisabled !== nextProps.sortDisabled ||
    prevProps.categoriesDisabled !== nextProps.categoriesDisabled
  ) {
    return false;
  }

  // Проверяем массивы
  if (
    prevProps.selectedCategories.length !== nextProps.selectedCategories.length ||
    prevProps.selectedCategories.some((cat, i) => cat !== nextProps.selectedCategories[i])
  ) {
    return false;
  }

  if (
    prevProps.selectedStickerTypes.length !== nextProps.selectedStickerTypes.length ||
    prevProps.selectedStickerTypes.some((type, i) => type !== nextProps.selectedStickerTypes[i])
  ) {
    return false;
  }

  if (prevProps.selectedDate !== nextProps.selectedDate) {
    return false;
  }

  // Проверяем categories массив
  if (
    prevProps.categories.length !== nextProps.categories.length ||
    prevProps.categories.some((cat, i) => cat.id !== nextProps.categories[i]?.id)
  ) {
    return false;
  }

  // Функции обычно стабильны через useCallback, проверяем по reference
  if (
    prevProps.onSearchChange !== nextProps.onSearchChange ||
    prevProps.onSearch !== nextProps.onSearch ||
    prevProps.onCategoryToggle !== nextProps.onCategoryToggle ||
    prevProps.onSortToggle !== nextProps.onSortToggle ||
    prevProps.onStickerTypeToggle !== nextProps.onStickerTypeToggle ||
    prevProps.onDateChange !== nextProps.onDateChange ||
    prevProps.onAddClick !== nextProps.onAddClick
  ) {
    return false;
  }

  // Ref обычно не меняется
  if (prevProps.scrollContainerRef !== nextProps.scrollContainerRef) {
    return false;
  }

  // Если все проверки прошли - пропсы равны, не перерисовываем
  return true;
};

export const GalleryControlsBar = memo(GalleryControlsBarComponent, arePropsEqual);
