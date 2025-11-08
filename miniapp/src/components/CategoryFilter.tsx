import React from 'react';
import { useTelegram } from '../hooks/useTelegram';

export interface Category {
  id: string;
  label: string;
  title?: string; // Tooltip
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategories: string[];
  onCategoryToggle: (categoryId: string) => void;
  disabled?: boolean;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategories,
  onCategoryToggle,
  disabled = false
}) => {
  const { tg } = useTelegram();

  const handleCategoryClick = (categoryId: string) => {
    if (disabled) return;
    
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    onCategoryToggle(categoryId);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 'calc(1rem * 0.382)',
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: 'calc(1rem * 0.382)',
        scrollbarWidth: 'none',
        maskImage: 'none',
        WebkitMaskImage: 'none',
      }}
      className="category-filter-scroller"
    >
      {categories.map((category) => {
        const isSelected = selectedCategories.includes(category.id);
        
        return (
          <div
            key={category.id}
            role="tab"
            aria-selected={isSelected}
            tabIndex={0}
            title={category.title || category.label}
            onClick={() => handleCategoryClick(category.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCategoryClick(category.id);
              }
            }}
            style={{
              flexShrink: 0,
              padding: '4px 8px',
              borderRadius: '13px',
              backgroundColor: isSelected
                ? 'var(--tg-theme-button-color, #2481cc)'
                : 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 25%, transparent)',
              color: isSelected
                ? 'var(--tg-theme-button-text-color, #ffffff)'
                : 'var(--tg-theme-text-color, #000000)',
              fontSize: '14px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: `1px solid ${isSelected 
                ? 'var(--tg-theme-button-color, #2481cc)' 
                : 'color-mix(in srgb, var(--tg-theme-hint-color) 40%, transparent)'}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              userSelect: 'none',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {category.label}
          </div>
        );
      })}
      <style>{`
        .category-filter-scroller::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};








