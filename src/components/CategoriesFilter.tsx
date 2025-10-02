import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Typography,
  useTheme,
  alpha,
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
  const theme = useTheme();
  const [isScrolling, setIsScrolling] = useState(false);

  const handleCategoryToggle = (categoryKey: string) => {
    const newSelected = selectedCategories.includes(categoryKey)
      ? selectedCategories.filter(key => key !== categoryKey)
      : [...selectedCategories, categoryKey];
    
    onCategoriesChange(newSelected);
  };

  const handleScroll = () => {
    setIsScrolling(true);
    clearTimeout(scrollTimeout);
    const scrollTimeout = setTimeout(() => setIsScrolling(false), 150);
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
    <Box sx={{ mb: 2 }}>
      <Typography 
        variant="body2" 
        color="text.secondary" 
        sx={{ mb: 1, px: 2 }}
      >
        Категории
      </Typography>
      
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          pb: 1,
          px: 2,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          },
          // Плавный скролл
          scrollBehavior: 'smooth',
          // Градиентные тени по краям
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(to right, ${theme.palette.background.default} 0%, transparent 20px, transparent calc(100% - 20px), ${theme.palette.background.default} 100%)`,
            pointerEvents: 'none',
            zIndex: 1
          }
        }}
        onScroll={handleScroll}
      >
        {categories.map((category) => {
          const isSelected = selectedCategories.includes(category.key);
          
          return (
            <Chip
              key={category.key}
              label={category.name}
              onClick={() => handleCategoryToggle(category.key)}
              variant={isSelected ? 'filled' : 'outlined'}
              size="medium"
              sx={{
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                boxShadow: isSelected 
                  ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                  : 'none',
                backgroundColor: isSelected 
                  ? theme.palette.primary.main
                  : theme.palette.background.paper,
                color: isSelected 
                  ? theme.palette.primary.contrastText
                  : theme.palette.text.primary,
                borderColor: isSelected 
                  ? theme.palette.primary.main
                  : theme.palette.divider,
                '&:hover': {
                  backgroundColor: isSelected 
                    ? theme.palette.primary.dark
                    : alpha(theme.palette.primary.main, 0.1),
                  transform: 'scale(1.05)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
                },
                '&:active': {
                  transform: 'scale(0.95)'
                },
                // Стили для выбранных категорий
                ...(isSelected && {
                  fontWeight: 600,
                  '& .MuiChip-label': {
                    fontWeight: 600
                  }
                })
              }}
            />
          );
        })}
      </Box>
      
      {selectedCategories.length > 0 && (
        <Box sx={{ px: 2, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Выбрано: {selectedCategories.length} категорий
          </Typography>
        </Box>
      )}
    </Box>
  );
};

