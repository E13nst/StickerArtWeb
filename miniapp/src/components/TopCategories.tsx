import React from 'react';
import { Box, Typography } from '@mui/material';

interface Category {
  name: string;
  count: number;
  emoji: string;
}

interface TopCategoriesProps {
  categories: Category[];
}

export const TopCategories: React.FC<TopCategoriesProps> = ({ categories }) => {
  return (
    <Box sx={{ mt: 4 }}>
      <Typography
        variant="h6"
        fontWeight="bold"
        sx={{
          color: 'var(--tg-theme-text-color)',
          mb: 2,
          fontSize: { xs: '1rem', sm: '1.25rem' }
        }}
      >
        ТОП-8 КАТЕГОРИЙ
      </Typography>
      <Box
        sx={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: 'calc(1rem * 0.382)',
          padding: 'calc(1rem * 0.382)',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
        }}
      >
        {categories.map((category) => (
          <Box
            key={category.name}
            role="button"
            tabIndex={0}
            onClick={() => {}}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
              }
            }}
            sx={{
              flexShrink: 0,
              padding: '4px 8px',
              borderRadius: '13px',
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 25%, transparent)',
              color: 'var(--tg-theme-text-color)',
              fontSize: '14px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 40%, transparent)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              userSelect: 'none',
              '&:hover': {
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 50%, transparent)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            {category.name} ({category.count})
          </Box>
        ))}
      </Box>
    </Box>
  );
};

