import React from 'react';
import {
  Box,
  Chip,
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
    <Box sx={{ 
      display: 'flex',
      gap: 1,
      overflowX: 'auto',
      pb: 0.25,
      '::-webkit-scrollbar': { display: 'none' },
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }} className="hide-scrollbar">
      {categories.map((category) => {
        const isSelected = selectedCategories.includes(category.key);
        
        return (
          <Chip
            key={category.key}
            label={category.name}
            onClick={() => handleCategoryToggle(category.key)}
            variant="outlined"
            className={isSelected ? "" : "fx-glass fx-lite"}
            sx={{
              flexShrink: 0,
              height: 32,
              fontSize: 13,
              color: isSelected ? '#fff' : 'rgba(255,255,255,0.9)',
              backgroundColor: isSelected 
                ? 'linear-gradient(135deg,#00C6FF 0%,#0072FF 100%)'
                : 'transparent',
              borderColor: isSelected ? 'transparent' : 'rgba(255,255,255,0.25)',
              boxShadow: isSelected ? '0 3px 8px rgba(0,114,255,0.20)' : '0 1px 3px rgba(0,0,0,0.05)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: isSelected 
                  ? 'linear-gradient(135deg,#00B8E6 0%,#0066CC 100%)'
                  : 'rgba(255,255,255,0.9)',
                transform: 'translateY(-1px)',
                boxShadow: isSelected 
                  ? '0 4px 12px rgba(0,114,255,0.25)' 
                  : '0 2px 6px rgba(0,0,0,0.08)',
              },
            }}
          />
        );
      })}
    </Box>
  );
};
