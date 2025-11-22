import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import { useTelegram } from '../hooks/useTelegram';
import { SearchBar } from './SearchBar';
import { CategoryFilter, Category } from './CategoryFilter';
import { StickerTypeDropdown } from './StickerTypeDropdown';
import { DateFilterDropdown } from './DateFilterDropdown';
import { SortDropdown } from './SortDropdown';
import { StickerSetTypeFilter, StickerSetType } from './StickerSetTypeFilter';

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
  
  // Add button
  onAddClick: () => void;
  
  // Position variant
  variant?: 'fixed' | 'static';
}

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
  variant = 'fixed',
}) => {
  const { tg } = useTelegram();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;
  
  // States for expansion
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Ref for filters dropdown to handle clicks outside
  const filtersMenuRef = useRef<HTMLDivElement>(null);

  // Glass effect colors
  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.28)' : 'rgba(88, 138, 255, 0.20)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.42)' : 'rgba(78, 132, 255, 0.20)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.38)' : 'rgba(98, 150, 255, 0.34)';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.52)' : 'rgba(118, 168, 255, 0.24)';
  const bgColor = isLight ? 'rgba(248, 251, 255, 0.95)' : 'rgba(18, 22, 29, 0.95)';

  // Toggle search expansion
  const handleSearchToggle = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('light');
    setSearchExpanded(prev => !prev);
    if (filtersExpanded) {
      setFiltersExpanded(false);
    }
  }, [tg, filtersExpanded]);

  // Toggle filters expansion
  const handleFiltersToggle = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('light');
    setFiltersExpanded(prev => !prev);
    if (searchExpanded) {
      setSearchExpanded(false);
    }
  }, [tg, searchExpanded]);

  // Handle add button click
  const handleAddClick = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('light');
    onAddClick();
  }, [tg, onAddClick]);

  // Handle reset filters
  const handleResetFilters = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('light');
    // Reset all filters to default values
    
    // Type filter - СКРЫТО: ждем API
    // const allTypes = ['static', 'animated', 'video', 'official'];
    // selectedStickerTypes.forEach(typeId => {
    //   if (!allTypes.includes(typeId)) {
    //     onStickerTypeToggle(typeId);
    //   }
    // });
    // allTypes.forEach(typeId => {
    //   if (!selectedStickerTypes.includes(typeId)) {
    //     onStickerTypeToggle(typeId);
    //   }
    // });
    
    // StickerSet Type filter - reset to all (empty array = all types)
    if (selectedStickerSetTypes.length > 0) {
      selectedStickerSetTypes.forEach(type => {
        onStickerSetTypeToggle(type);
      });
    }
    
    // Date filter - СКРЫТО: ждем API
    // if (selectedDate !== 'all') {
    //   onDateChange('all');
    // }
    
    // Sort - set to false (новые)
    if (sortByLikes) {
      onSortToggle();
    }
  }, [tg, sortByLikes, onSortToggle, selectedStickerSetTypes, onStickerSetTypeToggle]);

  // Close filters menu when clicking outside
  useEffect(() => {
    if (!filtersExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (filtersMenuRef.current && !filtersMenuRef.current.contains(event.target as Node)) {
        setFiltersExpanded(false);
      }
    };

    // Add a small delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filtersExpanded]);

  // Base button styles
  const iconButtonStyle: React.CSSProperties = {
    flexShrink: 0,
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
    opacity: 0.85,
    backdropFilter: 'blur(12px) saturate(150%)',
    WebkitBackdropFilter: 'blur(12px) saturate(150%)',
  };

  const addButtonStyle: React.CSSProperties = {
    ...iconButtonStyle,
    flex: '1 1 auto',
    padding: '0 0.75rem',
    gap: '0.42rem',
  };

  const isFixed = variant === 'fixed';
  
  return (
    <div
      className="compact-controls-bar"
      style={{
        position: isFixed ? 'fixed' : 'relative',
        top: isFixed ? 'calc(var(--stixly-header-height) + env(safe-area-inset-top))' : 'auto',
        left: isFixed ? 0 : 'auto',
        right: isFixed ? 0 : 'auto',
        zIndex: isFixed ? 998 : 'auto',
        backgroundColor: 'transparent',
        padding: '0.5rem 0.618rem',
      }}
    >
      {/* Main controls row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          mb: searchExpanded || filtersExpanded ? '0.5rem' : 0,
        }}
      >
        {/* Filters button */}
        <button
          onClick={handleFiltersToggle}
          aria-label={filtersExpanded ? "Скрыть фильтры" : "Показать фильтры"}
          style={{
            ...iconButtonStyle,
            background: filtersExpanded ? glassHover : glassBase,
            backgroundColor: filtersExpanded ? glassHover : glassSolid,
            transform: filtersExpanded ? 'scale(0.98)' : 'scale(1)',
            opacity: filtersExpanded ? 1 : 0.85,
          }}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, {
              background: glassHover,
              backgroundColor: glassHover,
              transform: 'scale(0.98)',
              opacity: '1',
            });
          }}
          onMouseLeave={(e) => {
            Object.assign(e.currentTarget.style, {
              background: filtersExpanded ? glassHover : glassBase,
              backgroundColor: filtersExpanded ? glassHover : glassSolid,
              transform: filtersExpanded ? 'scale(0.98)' : 'scale(1)',
              opacity: filtersExpanded ? '1' : '0.85',
            });
          }}
        >
          <TuneIcon sx={{ fontSize: '1rem' }} />
        </button>

        {/* Add button (hidden when search is expanded) */}
        {!searchExpanded && (
          <button
            onClick={handleAddClick}
            aria-label="Добавить стикер"
            style={addButtonStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                background: glassHover,
                backgroundColor: glassHover,
                transform: 'scale(0.98)',
                opacity: '1',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                background: glassBase,
                backgroundColor: glassSolid,
                transform: 'scale(1)',
                opacity: '0.85',
              });
            }}
          >
            <span style={{ fontSize: '0.875rem', lineHeight: '1', display: 'flex', alignItems: 'center', fontWeight: 400 }}>+</span>
            <span>Добавить</span>
            <span style={{ 
              fontSize: '0.6875rem', 
              opacity: isLight ? 0.82 : 0.88, 
              backgroundColor: glassSolid, 
              padding: '2px 5px', 
              borderRadius: '5px',
              border: `1px solid ${borderColor}` 
            }}>
              +10 ART
            </span>
          </button>
        )}

        {/* Search button/bar */}
        {searchExpanded ? (
          <Box sx={{ flex: '1 1 auto' }}>
            <SearchBar
              value={searchValue}
              onChange={onSearchChange}
              onSearch={onSearch}
              placeholder="Поиск стикеров..."
              disabled={searchDisabled}
              compact={true}
            />
          </Box>
        ) : (
          <button
            onClick={handleSearchToggle}
            aria-label="Поиск"
            style={iconButtonStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                background: glassHover,
                backgroundColor: glassHover,
                transform: 'scale(0.98)',
                opacity: '1',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                background: glassBase,
                backgroundColor: glassSolid,
                transform: 'scale(1)',
                opacity: '0.85',
              });
            }}
          >
            <SearchIcon sx={{ fontSize: '1rem' }} />
          </button>
        )}

        {/* Close search button (when expanded) */}
        {searchExpanded && (
          <button
            onClick={handleSearchToggle}
            aria-label="Закрыть поиск"
            style={iconButtonStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, {
                background: glassHover,
                backgroundColor: glassHover,
                transform: 'scale(0.98)',
                opacity: '1',
              });
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, {
                background: glassBase,
                backgroundColor: glassSolid,
                transform: 'scale(1)',
                opacity: '0.85',
              });
            }}
          >
            <CloseIcon sx={{ fontSize: '1rem' }} />
          </button>
        )}
      </Box>

      {/* Categories row (when search is expanded) */}
      {searchExpanded && categories.length > 0 && (
        <Box
          sx={{
            animation: 'fadeSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <CategoryFilter
            categories={categories}
            selectedCategories={selectedCategories}
            onCategoryToggle={onCategoryToggle}
            disabled={categoriesDisabled}
            compact={true}
          />
        </Box>
      )}

      {/* Filters dropdown menu (when filters are expanded) */}
      {filtersExpanded && (
        <Box
          ref={filtersMenuRef}
          sx={{
            mt: '0.5rem',
            animation: 'fadeSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Box
            sx={{
              backgroundColor: bgColor,
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderRadius: '0.75rem',
              border: `1px solid ${borderColor}`,
              boxShadow: isLight 
                ? '0 8px 32px rgba(30, 72, 185, 0.15)' 
                : '0 8px 32px rgba(0, 0, 0, 0.4)',
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxWidth: '200px',
              marginLeft: '0.618rem',
              marginRight: 'auto',
            }}
          >
            {/* Filter section title */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.35rem',
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  color: textColorResolved,
                  opacity: 0.9 
                }}>
                  Фильтры
                </span>
                {/* Reset button */}
                <button
                  onClick={handleResetFilters}
                  aria-label="Сбросить фильтры"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: textColorResolved,
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    padding: 0,
                    opacity: 0.6,
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                >
                  Сброс
                </button>
              </Box>
              {/* Close button */}
              <button
                onClick={handleFiltersToggle}
                aria-label="Закрыть фильтры"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: textColorResolved,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.25rem',
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                <CloseIcon sx={{ fontSize: '1rem' }} />
              </button>
            </Box>

            {/* Sticker Type Filter - СКРЫТО: ждем API */}
            {/* <Box>
              <StickerTypeDropdown
                selectedTypes={selectedStickerTypes}
                onTypeToggle={onStickerTypeToggle}
                disabled={false}
              />
            </Box> */}
            
            {/* StickerSet Type Filter (USER/OFFICIAL) */}
            <Box>
              <StickerSetTypeFilter
                selectedTypes={selectedStickerSetTypes}
                onTypeToggle={onStickerSetTypeToggle}
                disabled={false}
              />
            </Box>
            
            {/* Date Filter - СКРЫТО: ждем API */}
            {/* <Box>
              <DateFilterDropdown
                selectedDate={selectedDate}
                onDateChange={onDateChange}
                disabled={false}
              />
            </Box> */}
            
            {/* Sort Dropdown */}
            <Box>
              <SortDropdown
                sortByLikes={sortByLikes}
                onToggle={onSortToggle}
                disabled={sortDisabled}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Animation styles */}
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
    </div>
  );
};

// Мемоизация для предотвращения лишних перерисовок
const arePropsEqual = (
  prevProps: CompactControlsBarProps,
  nextProps: CompactControlsBarProps
): boolean => {
  // Check simple values
  if (
    prevProps.searchValue !== nextProps.searchValue ||
    prevProps.searchDisabled !== nextProps.searchDisabled ||
    prevProps.sortByLikes !== nextProps.sortByLikes ||
    prevProps.sortDisabled !== nextProps.sortDisabled ||
    prevProps.categoriesDisabled !== nextProps.categoriesDisabled
  ) {
    return false;
  }

  // Check arrays
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

  if (
    prevProps.selectedStickerSetTypes.length !== nextProps.selectedStickerSetTypes.length ||
    prevProps.selectedStickerSetTypes.some((type, i) => type !== nextProps.selectedStickerSetTypes[i])
  ) {
    return false;
  }

  if (prevProps.selectedDate !== nextProps.selectedDate) {
    return false;
  }

  // Check categories array
  if (
    prevProps.categories.length !== nextProps.categories.length ||
    prevProps.categories.some((cat, i) => cat.id !== nextProps.categories[i]?.id)
  ) {
    return false;
  }

  // Check function references
  if (
    prevProps.onSearchChange !== nextProps.onSearchChange ||
    prevProps.onSearch !== nextProps.onSearch ||
    prevProps.onCategoryToggle !== nextProps.onCategoryToggle ||
    prevProps.onSortToggle !== nextProps.onSortToggle ||
    prevProps.onStickerTypeToggle !== nextProps.onStickerTypeToggle ||
    prevProps.onStickerSetTypeToggle !== nextProps.onStickerSetTypeToggle ||
    prevProps.onDateChange !== nextProps.onDateChange ||
    prevProps.onAddClick !== nextProps.onAddClick
  ) {
    return false;
  }

  // All checks passed - props are equal, don't re-render
  return true;
};

export const CompactControlsBar = React.memo(CompactControlsBarComponent, arePropsEqual);

