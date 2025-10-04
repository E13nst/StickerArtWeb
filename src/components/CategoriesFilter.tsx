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
      mt: 1,
      mb: 1.25,
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
      px: 0.5,
      pb: 0.25,
      '::-webkit-scrollbar': { display: 'none' }
    }}>
      {categories.map((category) => {
        const isSelected = selectedCategories.includes(category.key);
        
        return (
          <Chip
            key={category.key}
            label={category.name}
            onClick={() => handleCategoryToggle(category.key)}
            variant="outlined"
            sx={{
              flexShrink: 0,
              height: 30,
              fontSize: 13,
              color: isSelected ? '#fff' : 'rgba(15,23,42,0.62)',
              backgroundColor: isSelected 
                ? 'linear-gradient(135deg,#00C6FF 0%,#0072FF 100%)'
                : '#F3F4F6',
              borderColor: isSelected ? 'transparent' : 'rgba(0,0,0,0.06)',
              boxShadow: isSelected ? '0 3px 8px rgba(0,114,255,0.20)' : 'none',
              '&:hover': {
                backgroundColor: isSelected 
                  ? 'linear-gradient(135deg,#00B8E6 0%,#0066CC 100%)'
                  : '#E5E7EB',
              },
            }}
          />
        );
      })}
    </Box>
  );
};
