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
        padding: '4px 8px',
        height: '48px',
        backgroundColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflow: 'auto hidden',
          scrollbarWidth: 'none',
          height: '100%',
          alignItems: 'center',
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
                  : 'var(--tg-theme-secondary-bg-color, #ffffff)',
                color: isSelected
                  ? 'var(--tg-theme-button-text-color, #ffffff)'
                  : 'var(--tg-theme-text-color, #000000)',
                fontSize: '14px',
                fontWeight: isSelected ? 500 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '32px',
                whiteSpace: 'nowrap',
                outline: 'none',
                border: 'none',
                boxShadow: 'none',
                userSelect: 'none',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {category.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

