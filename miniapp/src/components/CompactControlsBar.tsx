import { useState, useCallback, useEffect, useRef, memo, FC, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTelegram } from '../hooks/useTelegram';
import { SearchBar } from './SearchBar';
import { Category } from './CategoryFilter';
import { SortDropdown } from './SortDropdown';
import { StickerSetType } from './StickerSetTypeFilter';
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

const CompactControlsBarComponent: FC<CompactControlsBarProps> = ({
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
  selectedStickerTypes: _selectedStickerTypes,
  onStickerTypeToggle: _onStickerTypeToggle,
  selectedStickerSetTypes,
  onStickerSetTypeToggle,
  selectedDate: _selectedDate,
  onDateChange: _onDateChange,
  onAddClick: _onAddClick,
  variant = 'fixed',
}) => {
  const { tg, user } = useTelegram();
  const isRu = (user?.language_code || 'ru').toLowerCase().startsWith('ru');

  const text = {
    searchPlaceholder: isRu ? 'Поиск' : 'Search',
    dateTrigger: isRu ? 'Дата' : 'Date',
    filtersTitle: isRu ? 'Фильтры' : 'Filters',
    reset: isRu ? 'Сброс' : 'Reset',
    closeFilters: isRu ? 'Закрыть фильтры' : 'Close filters',
    showFilters: isRu ? 'Показать фильтры' : 'Show filters',
    hideFilters: isRu ? 'Скрыть фильтры' : 'Hide filters',
    typeTitle: isRu ? 'Тип' : 'Type',
    categoryTitle: isRu ? 'Категории' : 'Category',
    sortTitle: isRu ? 'Сортировка' : 'Sort By',
    sortByPopularity: isRu ? 'По популярности' : 'By popularity',
    sortByDateNew: isRu ? 'Сначала новые' : 'Date (new)',
    typeAll: isRu ? 'Все' : 'All',
    typeOfficial: isRu ? 'Официальные' : 'Official',
    typeCustom: isRu ? 'Пользовательские' : 'Custom',
  };
  
  // State for filters expansion (search always visible in row per Figma Search + filter)
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Ref for filters dropdown to handle clicks outside
  const filtersMenuRef = useRef<HTMLDivElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);

  // Toggle filters expansion
  const handleFiltersToggle = useCallback((e?: MouseEvent) => {
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

    // Categories - reset to all (empty selection)
    if (selectedCategories.length > 0) {
      selectedCategories.forEach((categoryId) => {
        onCategoryToggle(categoryId);
      });
    }
    
    // Close filters menu after reset
    setFiltersExpanded(false);
  }, [tg, sortByLikes, onSortToggle, selectedStickerSetTypes, onStickerSetTypeToggle, selectedCategories, onCategoryToggle]);

  const isAllTypesSelected = selectedStickerSetTypes.length === 0;
  const isUserTypeSelected = selectedStickerSetTypes.length === 1 && selectedStickerSetTypes[0] === 'USER';
  const isOfficialTypeSelected = selectedStickerSetTypes.length === 1 && selectedStickerSetTypes[0] === 'OFFICIAL';

  const setStickerSetTypeMode = useCallback((mode: 'ALL' | 'USER' | 'OFFICIAL') => {
    tg?.HapticFeedback?.impactOccurred('light');

    const hasUser = selectedStickerSetTypes.includes('USER');
    const hasOfficial = selectedStickerSetTypes.includes('OFFICIAL');

    if (mode === 'ALL') {
      if (hasUser) onStickerSetTypeToggle('USER');
      if (hasOfficial) onStickerSetTypeToggle('OFFICIAL');
      return;
    }

    if (mode === 'USER') {
      if (hasOfficial) onStickerSetTypeToggle('OFFICIAL');
      if (!hasUser) onStickerSetTypeToggle('USER');
      return;
    }

    if (hasUser) onStickerSetTypeToggle('USER');
    if (!hasOfficial) onStickerSetTypeToggle('OFFICIAL');
  }, [tg, selectedStickerSetTypes, onStickerSetTypeToggle]);

  // Close filters menu when clicking outside (panel рендерится в portal в body)
  useEffect(() => {
    if (!filtersExpanded) return;

    const handleClickOutside = (event: Event) => {
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
              placeholder={text.searchPlaceholder}
              disabled={searchDisabled}
              compact={true}
            />
          </div>

          <div className="compact-controls-bar__date-slot">
            <SortDropdown
              sortByLikes={sortByLikes}
              onToggle={onSortToggle}
              disabled={sortDisabled}
              triggerLabel={text.dateTrigger}
            />
          </div>

          <button
            ref={filtersButtonRef}
            onClick={handleFiltersToggle}
            aria-label={filtersExpanded ? text.hideFilters : text.showFilters}
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
                className="sort-dropdown__panel compact-controls-bar__filters-panel"
                role="dialog"
                aria-label={text.filtersTitle}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sort-dropdown__inner">
                  <div className="compact-controls-bar__panel-grab" aria-hidden />
                  <div className="compact-controls-bar__dropdown-header compact-controls-bar__filters-header">
                    <span className="sort-dropdown__title">{text.filtersTitle}</span>
                    <div className="compact-controls-bar__dropdown-actions">
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        aria-label={text.reset}
                        className="compact-controls-bar__btn-reset"
                      >
                        {text.reset}
                      </button>
                      <button
                        type="button"
                        onClick={handleFiltersToggle}
                        aria-label={text.closeFilters}
                        className="compact-controls-bar__btn-close"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                  <div className="compact-controls-bar__filters-content">
                    <div className="compact-controls-bar__filters-section">
                      <h3 className="compact-controls-bar__filters-section-title">{text.typeTitle}</h3>
                      <div className="compact-controls-bar__chips-row compact-controls-bar__chips-row--type">
                        <button
                          type="button"
                          className={`compact-controls-bar__chip ${isAllTypesSelected ? 'compact-controls-bar__chip--active' : ''}`}
                          onClick={() => setStickerSetTypeMode('ALL')}
                          disabled={categoriesDisabled}
                        >
                          {text.typeAll}
                        </button>
                        <button
                          type="button"
                          className={`compact-controls-bar__chip ${isOfficialTypeSelected ? 'compact-controls-bar__chip--active' : ''}`}
                          onClick={() => setStickerSetTypeMode('OFFICIAL')}
                          disabled={categoriesDisabled}
                        >
                          {text.typeOfficial}
                        </button>
                        <button
                          type="button"
                          className={`compact-controls-bar__chip ${isUserTypeSelected ? 'compact-controls-bar__chip--active' : ''}`}
                          onClick={() => setStickerSetTypeMode('USER')}
                          disabled={categoriesDisabled}
                        >
                          {text.typeCustom}
                        </button>
                      </div>
                    </div>

                    <div className="compact-controls-bar__filters-section compact-controls-bar__filters-section--categories">
                      <h3 className="compact-controls-bar__filters-section-title">{text.categoryTitle}</h3>
                      <div className="compact-controls-bar__chips-grid" role="group" aria-label={text.categoryTitle}>
                        {categories.map((category) => {
                          const isSelected = selectedCategories.includes(category.id);
                          return (
                            <button
                              key={category.id}
                              type="button"
                              className={`compact-controls-bar__chip ${isSelected ? 'compact-controls-bar__chip--active' : ''}`}
                              onClick={() => onCategoryToggle(category.id)}
                              disabled={categoriesDisabled}
                              title={category.title || category.label}
                            >
                              {category.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="compact-controls-bar__filters-sort" role="group" aria-label={text.sortTitle}>
                    <div className="sort-dropdown__header">
                      <span className="sort-dropdown__title">{text.sortTitle}</span>
                    </div>
                    <button
                      type="button"
                      className={`sort-dropdown__option${sortByLikes ? ' sort-dropdown__option--active' : ''}`}
                      onClick={() => {
                        if (!sortByLikes) onSortToggle();
                        setFiltersExpanded(false);
                      }}
                      disabled={sortDisabled}
                    >
                      <span className={`sort-dropdown__option-label${sortByLikes ? ' sort-dropdown__option-label--active' : ''}`}>
                        {text.sortByPopularity}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`sort-dropdown__option${!sortByLikes ? ' sort-dropdown__option--active' : ''}`}
                      onClick={() => {
                        if (sortByLikes) onSortToggle();
                        setFiltersExpanded(false);
                      }}
                      disabled={sortDisabled}
                    >
                      <span className={`sort-dropdown__option-label${!sortByLikes ? ' sort-dropdown__option-label--active' : ''}`}>
                        {text.sortByDateNew}
                      </span>
                    </button>
                  </div>
                  <div className="compact-controls-bar__panel-home-indicator" aria-hidden />
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

export const CompactControlsBar = memo(CompactControlsBarComponent, arePropsEqual);
