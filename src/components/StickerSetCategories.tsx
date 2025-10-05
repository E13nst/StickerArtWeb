import React from 'react';
import {
  Box,
  Chip,
  Typography,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import { CategoryDto } from '@/types/category';

interface StickerSetCategoriesProps {
  categories: CategoryDto[];
  maxVisible?: number;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

export const StickerSetCategories: React.FC<StickerSetCategoriesProps> = ({
  categories,
  maxVisible = 3,
  size = 'small',
  showLabel = false
}) => {
  const theme = useTheme();

  if (!categories || categories.length === 0) {
    return null;
  }

  const visibleCategories = categories.slice(0, maxVisible);
  const hiddenCount = categories.length - maxVisible;

  const getChipSize = () => {
    switch (size) {
      case 'small':
        return { height: 20, fontSize: '0.7rem', padding: '0 8px' };
      case 'medium':
        return { height: 24, fontSize: '0.75rem', padding: '0 10px' };
      default:
        return { height: 20, fontSize: '0.7rem', padding: '0 8px' };
    }
  };

  const chipStyle = getChipSize();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {showLabel && (
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ fontSize: '0.65rem', fontWeight: 500 }}
        >
          Категории:
        </Typography>
      )}
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {visibleCategories.map((category) => (
          <Tooltip key={category.id} title={category.description} arrow>
            <Chip
              label={category.name}
              size="small"
              sx={{
                height: chipStyle.height,
                fontSize: chipStyle.fontSize,
                padding: chipStyle.padding,
                backgroundColor: 'rgba(130, 160, 255, 0.15)',
                color: 'rgba(130, 160, 255, 0.9)',
                border: '1px solid rgba(130, 160, 255, 0.30)',
                borderRadius: '12px',
                fontWeight: 500,
                cursor: 'default',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(130, 160, 255, 0.25)',
                  transform: 'scale(1.02)',
                },
                '& .MuiChip-label': {
                  padding: '0 4px',
                  fontSize: chipStyle.fontSize,
                  fontWeight: 500,
                }
              }}
            />
          </Tooltip>
        ))}
        
        {hiddenCount > 0 && (
          <Tooltip 
            title={`Еще ${hiddenCount} категорий: ${categories.slice(maxVisible).map(c => c.name).join(', ')}`} 
            arrow
          >
            <Chip
              label={`+${hiddenCount}`}
              size="small"
              sx={{
                height: chipStyle.height,
                fontSize: chipStyle.fontSize,
                padding: chipStyle.padding,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                fontWeight: 500,
                cursor: 'default',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  transform: 'scale(1.02)',
                },
                '& .MuiChip-label': {
                  padding: '0 4px',
                  fontSize: chipStyle.fontSize,
                  fontWeight: 500,
                }
              }}
            />
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

