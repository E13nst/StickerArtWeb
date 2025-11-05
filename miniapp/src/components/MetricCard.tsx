import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: string;
  period?: string;
  icon?: string;
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  period,
  icon,
  color = 'var(--tg-theme-button-color)'
}) => {
  return (
    <Card
      sx={{
        borderRadius: 3,
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: 'none',
        height: '100%',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'var(--tg-theme-hint-color)',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            {title}
          </Typography>
          {icon && (
            <Typography sx={{ fontSize: '1.5rem' }}>{icon}</Typography>
          )}
        </Box>
        
        <Typography
          variant="h4"
          fontWeight="bold"
          sx={{
            color,
            mb: trend ? 0.5 : 0,
            fontSize: { xs: '1.5rem', sm: '1.75rem' }
          }}
        >
          {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
        </Typography>

        {trend && period && (
          <Typography
            variant="caption"
            sx={{
              color: trend.startsWith('+') 
                ? 'var(--tg-theme-button-color)' 
                : 'var(--tg-theme-hint-color)',
              fontSize: '0.7rem',
              fontWeight: 500
            }}
          >
            {trend} за {period}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

