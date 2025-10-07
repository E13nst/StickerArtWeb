import React from 'react';
import {
  Box,
  Skeleton
} from '@mui/material';
import { CategoryDto } from '@/types/category';

interface CategoriesFilterProps {
  categories: CategoryDto[];
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  loading?: boolean;
}

export const CategoriesFilter: React.FC<CategoriesFilterProps> = ({
  categories,
  selectedCategories,
  onCategoriesChange,
  loading = false
}) => {
  const handleCategoryToggle = (categoryKey: string) => {
    const newSelected = selectedCategories.includes(categoryKey)
      ? selectedCategories.filter(key => key !== categoryKey)
      : [...selectedCategories, categoryKey];
    
    onCategoriesChange(newSelected);
  };

  if (loading) {
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'hidden', pb: 1 }}>
          {[...Array(5)].map((_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              width={120}
              height={32}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <Box className="filters-row" sx={{ 
      '::-webkit-scrollbar': { display: 'none' },
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      {categories.map((category) => {
        const isSelected = (selectedCategories || []).includes(category.key);
        
        return (
          <Box
            key={category.key}
            className={`chip category-chip smooth-transition ${isSelected ? 'chip--active' : ''}`}
            onClick={() => handleCategoryToggle(category.key)}
            sx={{
              flexShrink: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.02)',
              },
            }}
          >
            {category.name}
          </Box>
        );
      })}
    </Box>
  );
};

