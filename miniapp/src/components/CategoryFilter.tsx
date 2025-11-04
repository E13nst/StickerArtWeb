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
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0 0.618rem', // Отступы по горизонтали
        minHeight: '2.5rem',
        backgroundColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflow: 'auto hidden',
          scrollbarWidth: 'none',
          height: '100%',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
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
                padding: '0 0.618rem', // Отступы по горизонтали
                borderRadius: '0.59rem', // 0.236 * 2.5rem ≈ 0.59rem
                backgroundColor: isSelected
                  ? 'var(--tg-theme-button-color, #2481cc)'
                  : 'var(--tg-theme-secondary-bg-color, #ffffff)',
                color: isSelected
                  ? 'var(--tg-theme-button-text-color, #ffffff)'
                  : 'var(--tg-theme-text-color, #000000)',
                fontSize: '0.875rem', // 14px
                fontWeight: isSelected ? 600 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '2.5rem', // Высота по пропорции
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








