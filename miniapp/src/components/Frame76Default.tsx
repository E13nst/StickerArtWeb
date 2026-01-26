import React from 'react';
import { Box, Typography } from '@mui/material';

export interface Frame76TaskProgress {
  title: string;
  current: number;
  total: number;
  completed: boolean;
}

interface Frame76DefaultProps {
  tasks: Frame76TaskProgress[];
}

/**
 * Figma: #components → Frame 76 Default
 * Блок прогресса задач (2 колонки), который ранее рендерился внутри `DailyActivity`.
 */
export const Frame76Default: React.FC<Frame76DefaultProps> = ({ tasks }) => {
  return (
    <Box
      data-figma-component="Frame 76 Default"
      data-react-component="Frame76Default"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px 16px',
        marginBottom: '16px'
      }}
    >
      {tasks.map((task, index) => {
        const progress = task.total > 0 ? (task.current / task.total) * 100 : 0;
        const isCompleted = task.completed || task.current >= task.total;

        return (
          <Box
            key={index}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <Typography
              sx={{
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'SF Pro Rounded, -apple-system, BlinkMacSystemFont, sans-serif',
                lineHeight: '22px'
              }}
            >
              {task.title}
            </Typography>

            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: '6px',
                borderRadius: '6px',
                backgroundColor: isCompleted ? '#ee449f' : 'rgba(255, 255, 255, 1)',
                overflow: 'hidden'
              }}
            >
              {!isCompleted && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: '#ee449f',
                    borderRadius: '6px'
                  }}
                />
              )}

              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                  paddingX: '4px'
                }}
              >
                <Typography
                  sx={{
                    color: isCompleted ? '#ee449f' : '#ee449f',
                    fontSize: '8px',
                    fontWeight: 700,
                    fontFamily: 'SF Pro Rounded, -apple-system, BlinkMacSystemFont, sans-serif',
                    lineHeight: '6px'
                  }}
                >
                  {task.current}/{task.total}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
