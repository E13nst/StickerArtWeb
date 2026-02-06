import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTelegram } from '../hooks/useTelegram';
import { SearchBar } from './SearchBar';
import { CategoryFilter, Category } from './CategoryFilter';
import { SortDropdown } from './SortDropdown';
import { StickerSetTypeFilter, StickerSetType } from './StickerSetTypeFilter';
import './CompactControlsBar.css';
import './SortDropdown.css';

interface CompactControlsBarProps {
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
  
  // Sticker Set Type Filter (USER/OFFICIAL)
  selectedStickerSetTypes: StickerSetType[];
  onStickerSetTypeToggle: (type: StickerSetType) => void;
  
  // Date Filter
  selectedDate: string | null;
  onDateChange: (dateId: string) => void;
  
  /** Кнопка «Добавить» не входит в блок Search + filter по Figma; оставлено для совместимости, можно рендерить отдельно на странице */
  onAddClick?: () => void;
  
  // Apply filters callback
  onApplyFilters?: () => void;
  
  // Position variant
  variant?: 'fixed' | 'static';
}

// SVG Icons
const TuneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14"></line>
    <line x1="4" y1="10" x2="4" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12" y2="3"></line>
    <line x1="20" y1="21" x2="20" y2="16"></line>
    <line x1="20" y1="12" x2="20" y2="3"></line>
    <line x1="1" y1="14" x2="7" y2="14"></line>
    <line x1="9" y1="8" x2="15" y2="8"></line>
    <line x1="17" y1="16" x2="23" y2="16"></line>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const CompactControlsBarComponent: React.FC<CompactControlsBarProps> = ({
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
  selectedStickerSetTypes,
  onStickerSetTypeToggle,
  selectedDate,
  onDateChange,
  onAddClick,
  onApplyFilters,
  variant = 'fixed',
}) => {
  const { tg } = useTelegram();
  
  // State for filters expansion (search always visible in row per Figma Search + filter)
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Ref for filters dropdown to handle clicks outside
  const filtersMenuRef = useRef<HTMLDivElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);

  // Toggle filters expansion
  const handleFiltersToggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    tg?.HapticFeedback?.impactOccurred('light');
    setFiltersExpanded(prev => !prev);
  }, [tg]);

  // Handle reset filters
  const handleResetFilters = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('light');
    
    // StickerSet Type filter - reset to all (empty array = all types)
    if (selectedStickerSetTypes.length > 0) {
      selectedStickerSetTypes.forEach(type => {
        onStickerSetTypeToggle(type);
      });
    }
    
    // Sort - set to false (новые)
    if (sortByLikes) {
      onSortToggle();
    }
    
    // Close filters menu after reset
    setFiltersExpanded(false);
  }, [tg, sortByLikes, onSortToggle, selectedStickerSetTypes, onStickerSetTypeToggle]);

  // Handle apply filters
  const handleApplyFilters = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('medium');
    onApplyFilters?.();
    setFiltersExpanded(false);
  }, [tg, onApplyFilters]);

  // Close filters menu when clicking outside (panel рендерится в portal в body)
  useEffect(() => {
    if (!filtersExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const el = target as Element;
      if (filtersButtonRef.current?.contains(target) || filtersMenuRef.current?.contains(target)) return;
      if (el.closest?.('[data-sort-dropdown-panel]')) return;
      setFiltersExpanded(false);
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filtersExpanded]);

  const isFixed = variant === 'fixed';
  const rowHasExtra = filtersExpanded;
  
  return (
    <div
      className={`compact-controls-bar ${isFixed ? 'compact-controls-bar--fixed' : ''}`}
    >
      <div className="compact-controls-bar-inner">
        {/* Row: Search (input) | Date (sort) | Filter — по макету Figma "Search + filter" */}
        <div className={`compact-controls-bar__row ${rowHasExtra ? 'compact-controls-bar__row--with-extra' : ''}`}>
          <div className="compact-controls-bar__search-slot">
            <SearchBar
              value={searchValue}
              onChange={onSearchChange}
              onSearch={onSearch}
              placeholder="Search"
              disabled={searchDisabled}
              compact={true}
            />
          </div>

          <div className="compact-controls-bar__date-slot">
            <SortDropdown
              sortByLikes={sortByLikes}
              onToggle={onSortToggle}
              disabled={sortDisabled}
              triggerLabel="Date"
            />
          </div>

          <button
            ref={filtersButtonRef}
            onClick={handleFiltersToggle}
            aria-label={filtersExpanded ? 'Скрыть фильтры' : 'Показать фильтры'}
            className={`compact-controls-bar__btn ${filtersExpanded ? 'compact-controls-bar__btn--active' : ''}`}
          >
            <TuneIcon />
          </button>
        </div>

        {filtersExpanded &&
          createPortal(
            <>
              <div
                className="sort-dropdown__backdrop"
                onClick={handleFiltersToggle}
                aria-hidden
              />
              <div
                ref={filtersMenuRef}
                data-sort-dropdown-panel
                className="sort-dropdown__panel"
                role="dialog"
                aria-label="Фильтры"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sort-dropdown__inner compact-controls-bar__filters-inner">
                  <div className="compact-controls-bar__dropdown-header compact-controls-bar__filters-header">
                    <span className="sort-dropdown__title">Фильтры</span>
                    <div className="compact-controls-bar__dropdown-actions">
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        aria-label="Сбросить фильтры"
                        className="compact-controls-bar__btn-reset"
                      >
                        Сброс
                      </button>
                      <button
                        type="button"
                        onClick={handleFiltersToggle}
                        aria-label="Закрыть фильтры"
                        className="compact-controls-bar__btn-close"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                  <div className="compact-controls-bar__filters-content">
                    <StickerSetTypeFilter
                      selectedTypes={selectedStickerSetTypes}
                      onTypeToggle={onStickerSetTypeToggle}
                      disabled={false}
                    />
                  </div>
                  <div className="compact-controls-bar__filters-sort">
                    <SortDropdown
                      sortByLikes={sortByLikes}
                      onToggle={onSortToggle}
                      disabled={sortDisabled}
                    />
                  </div>
                </div>
              </div>
            </>,
            document.body
          )}
      </div>
    </div>
  );
};

// Мемоизация для предотвращения лишних перерисовок
const arePropsEqual = (
  prevProps: CompactControlsBarProps,
  nextProps: CompactControlsBarProps
): boolean => {
  if (
    prevProps.searchValue !== nextProps.searchValue ||
    prevProps.searchDisabled !== nextProps.searchDisabled ||
    prevProps.sortByLikes !== nextProps.sortByLikes ||
    prevProps.sortDisabled !== nextProps.sortDisabled ||
    prevProps.categoriesDisabled !== nextProps.categoriesDisabled
  ) {
    return false;
  }

  if (
    prevProps.selectedCategories?.length !== nextProps.selectedCategories?.length ||
    prevProps.selectedCategories?.some((cat, i) => cat !== nextProps.selectedCategories[i])
  ) {
    return false;
  }

  if (
    prevProps.selectedStickerTypes?.length !== nextProps.selectedStickerTypes?.length ||
    prevProps.selectedStickerTypes?.some((type, i) => type !== nextProps.selectedStickerTypes?.[i])
  ) {
    return false;
  }

  if (
    prevProps.selectedStickerSetTypes?.length !== nextProps.selectedStickerSetTypes?.length ||
    prevProps.selectedStickerSetTypes?.some((type, i) => type !== nextProps.selectedStickerSetTypes?.[i])
  ) {
    return false;
  }

  if (prevProps.selectedDate !== nextProps.selectedDate) {
    return false;
  }

  if (
    prevProps.categories?.length !== nextProps.categories?.length ||
    prevProps.categories?.some((cat, i) => cat.id !== nextProps.categories?.[i]?.id)
  ) {
    return false;
  }

  if (
    prevProps.onSearchChange !== nextProps.onSearchChange ||
    prevProps.onSearch !== nextProps.onSearch ||
    prevProps.onCategoryToggle !== nextProps.onCategoryToggle ||
    prevProps.onSortToggle !== nextProps.onSortToggle ||
    prevProps.onStickerTypeToggle !== nextProps.onStickerTypeToggle ||
    prevProps.onStickerSetTypeToggle !== nextProps.onStickerSetTypeToggle ||
    prevProps.onDateChange !== nextProps.onDateChange ||
    prevProps.onAddClick !== nextProps.onAddClick ||
    prevProps.onApplyFilters !== nextProps.onApplyFilters
  ) {
    return false;
  }

  return true;
};

export const CompactControlsBar = React.memo(CompactControlsBarComponent, arePropsEqual);
