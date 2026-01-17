import React from 'react';
import { Box, Typography } from '@mui/material';

interface StatisticsCardProps {
  likes: {
    value: number;
    trend: string;
  };
  creations: {
    value: number;
    trend: string;
  };
  artpoints: {
    value: number;
    trend: string;
  };
}

export const StatisticsCard: React.FC<StatisticsCardProps> = ({
  likes,
  creations,
  artpoints
}) => {
  const formatNumber = (num: number): string => {
    return num.toLocaleString('ru-RU');
  };

  return (
    <Box
      sx={{
        width: '100%',
        backgroundColor: 'rgba(169, 70, 181, 0.1)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '24px'
      }}
    >
      {/* Заголовок */}
      <Typography
        sx={{
          textAlign: 'center',
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
          marginBottom: '16px'
        }}
      >
        Our Statistics
      </Typography>

      {/* Три метрики в ряд */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px'
        }}
      >
        {/* Likes */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Typography
            sx={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 400,
              fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
              marginBottom: '8px',
              textAlign: 'center'
            }}
          >
            Likes
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px'
            }}
          >
            <Typography
              sx={{
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 700,
                fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
            >
              {formatNumber(likes.value)}
            </Typography>
            <Typography
              sx={{
                color: '#67f56b',
                fontSize: '12px',
                fontWeight: 300,
                fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
            >
              {likes.trend}
            </Typography>
          </Box>
        </Box>

        {/* Creations */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Typography
            sx={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 400,
              fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
              marginBottom: '8px',
              textAlign: 'center'
            }}
          >
            Сreations
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px'
            }}
          >
            <Typography
              sx={{
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 700,
                fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
            >
              {formatNumber(creations.value)}
            </Typography>
            <Typography
              sx={{
                color: '#67f56b',
                fontSize: '12px',
                fontWeight: 300,
                fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
            >
              {creations.trend}
            </Typography>
          </Box>
        </Box>

        {/* Artpoints */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Typography
            sx={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 400,
              fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
              marginBottom: '8px',
              textAlign: 'center'
            }}
          >
            Artpoints
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px'
            }}
          >
            <Typography
              sx={{
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 700,
                fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
            >
              {formatNumber(artpoints.value)}
            </Typography>
            <Typography
              sx={{
                color: '#67f56b',
                fontSize: '12px',
                fontWeight: 300,
                fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif'
              }}
            >
              {artpoints.trend}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
