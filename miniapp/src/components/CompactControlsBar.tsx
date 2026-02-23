import { useState, useCallback, useEffect, useRef, memo, FC, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTelegram } from '../hooks/useTelegram';
import { SearchBar } from './SearchBar';
import { Category } from './CategoryFilter';
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
  variant = 'static',
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
    sortByPopularity: isRu ? 'Сначала популярные' : 'By popularity',
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

  // Свайп вниз для закрытия панели (как у модалки StickerSetDetail)
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingDownRef = useRef(false);
  const DISMISS_THRESHOLD = 100;
  const DRAG_ANIMATION_MS = 200;

  useEffect(() => {
    if (!filtersExpanded) return;
    const panel = filtersMenuRef.current;
    if (!panel) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Начинаем drag только если контент прокручен до верха (как у модалки)
      const scrollTop = panel.scrollTop ?? 0;
      if (scrollTop <= 0) {
        touchStartYRef.current = e.touches[0].clientY;
      } else {
        touchStartYRef.current = null;
      }
      isDraggingDownRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const deltaY = e.touches[0].clientY - touchStartYRef.current;

      if (deltaY > 5) {
        isDraggingDownRef.current = true;
        e.preventDefault();
        panel.style.animation = 'none';
        panel.style.transition = 'none';
        panel.style.transform = `translateY(${deltaY}px)`;
        panel.classList.add('sort-dropdown__panel--dragging');
        const backdrop = panel.previousElementSibling as HTMLElement | null;
        if (backdrop) {
          const progress = Math.min(deltaY / 400, 1);
          backdrop.style.opacity = String(1 - progress * 0.6);
        }
      } else if (deltaY < -5) {
        touchStartYRef.current = null;
        isDraggingDownRef.current = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartYRef.current === null || !isDraggingDownRef.current) {
        touchStartYRef.current = null;
        isDraggingDownRef.current = false;
        return;
      }
      e.preventDefault();

      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
      touchStartYRef.current = null;
      isDraggingDownRef.current = false;
      const backdrop = panel.previousElementSibling as HTMLElement | null;

      if (deltaY > DISMISS_THRESHOLD) {
        panel.style.transition = `transform ${DRAG_ANIMATION_MS}ms ease-out`;
        panel.style.transform = 'translateY(100vh)';
        if (backdrop) {
          backdrop.style.transition = `opacity ${DRAG_ANIMATION_MS}ms ease-out`;
          backdrop.style.opacity = '0';
        }
        setTimeout(() => {
          panel.classList.remove('sort-dropdown__panel--dragging');
          panel.classList.add('sort-dropdown__panel--drag-dismissed');
          setFiltersExpanded(false);
          panel.style.animation = '';
          panel.style.transition = '';
          panel.style.transform = '';
          if (backdrop) {
            backdrop.style.transition = '';
            backdrop.style.opacity = '';
          }
        }, DRAG_ANIMATION_MS);
      } else {
        panel.style.transition = `transform ${DRAG_ANIMATION_MS}ms ease-out`;
        panel.style.transform = 'translateY(0)';
        if (backdrop) {
          backdrop.style.transition = `opacity ${DRAG_ANIMATION_MS}ms ease-out`;
          backdrop.style.opacity = '1';
        }
        setTimeout(() => {
          panel.style.animation = '';
          panel.style.transition = '';
          panel.style.transform = '';
          panel.classList.remove('sort-dropdown__panel--dragging');
          if (backdrop) {
            backdrop.style.transition = '';
            backdrop.style.opacity = '';
          }
        }, DRAG_ANIMATION_MS);
      }
    };

    panel.addEventListener('touchstart', handleTouchStart, { passive: true });
    panel.addEventListener('touchmove', handleTouchMove, { passive: false });
    panel.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      panel.removeEventListener('touchstart', handleTouchStart);
      panel.removeEventListener('touchmove', handleTouchMove);
      panel.removeEventListener('touchend', handleTouchEnd);
    };
  }, [filtersExpanded]);

  // Toggle filters expansion
  const handleFiltersToggle = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
    tg?.HapticFeedback?.impactOccurred('light');
    setFiltersExpanded(prev => !prev);
  }, [tg]);

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

          <button
            ref={filtersButtonRef}
            onClick={handleFiltersToggle}
            aria-label={filtersExpanded ? text.hideFilters : text.showFilters}
            aria-expanded={filtersExpanded}
            className={`compact-controls-bar__date-slot compact-controls-bar__btn ${filtersExpanded ? 'compact-controls-bar__btn--active' : ''}`}
          >
            <TuneIcon />
            <span>{text.dateTrigger}</span>
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
                  <div className="compact-controls-bar__filters-content">
                    {/* Типы — секция с переключателями */}
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

                    {/* Сортировка */}
                    <div className="compact-controls-bar__filters-section" role="group" aria-label={text.sortTitle}>
                      <h3 className="compact-controls-bar__filters-section-title">{text.sortTitle}</h3>
                      <div className="compact-controls-bar__chips-row compact-controls-bar__chips-row--sort">
                        <button
                          type="button"
                          className={`compact-controls-bar__chip ${sortByLikes ? 'compact-controls-bar__chip--active' : ''}`}
                          onClick={() => {
                            if (!sortByLikes) onSortToggle();
                          }}
                          disabled={sortDisabled}
                        >
                          {text.sortByPopularity}
                        </button>
                        <button
                          type="button"
                          className={`compact-controls-bar__chip ${!sortByLikes ? 'compact-controls-bar__chip--active' : ''}`}
                          onClick={() => {
                            if (sortByLikes) onSortToggle();
                          }}
                          disabled={sortDisabled}
                        >
                          {text.sortByDateNew}
                        </button>
                      </div>
                    </div>

                    {/* Категории */}
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
