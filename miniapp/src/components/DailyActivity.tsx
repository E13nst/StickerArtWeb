import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface TaskProgress {
  title: string;
  current: number;
  total: number;
  completed: boolean;
}

interface DailyActivityProps {
  tasks?: TaskProgress[];
  onCheckAll?: () => void;
}

// Заглушки данных (будут заменены API позже)
const defaultTasks: TaskProgress[] = [
  { title: 'Upgrade 10...', current: 5, total: 10, completed: false },
  { title: 'Share two Stickers', current: 2, total: 2, completed: true },
  { title: 'Visit Project', current: 1, total: 1, completed: true },
  { title: 'Create five Stickers', current: 5, total: 5, completed: true },
  { title: 'Buy 3...', current: 0, total: 3, completed: false },
  { title: 'Donate 3 authors...', current: 0, total: 3, completed: false }
];

export const DailyActivity: React.FC<DailyActivityProps> = ({
  tasks = defaultTasks,
  onCheckAll
}) => {
  // График точек активности (24 эллипса по дизайну Figma)
  // Паттерн: большие точки (6px) в позициях 0, 4, 9, 13, 17, 21
  // Маленькие точки (2px) в остальных позициях
  // Цвета: первые 10 розовые (#ee449f), остальные белые (#ffffff)
  const activityDots = React.useMemo(() => {
    const dots = [];
    const largeDotPositions = [0, 4, 9, 13, 17, 21]; // Позиции больших точек по дизайну
    const sizes = [6, 2]; // Размеры в px
    
    for (let i = 0; i < 24; i++) {
      const isLarge = largeDotPositions.includes(i);
      const color = i < 10 ? '#ee449f' : '#ffffff'; // Первые 10 розовые, остальные белые
      dots.push({
        size: isLarge ? sizes[0] : sizes[1],
        color,
        key: `dot-${i}`
      });
    }
    return dots;
  }, []);

  const handleCheckAll = () => {
    if (onCheckAll) {
      onCheckAll();
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        backgroundColor: 'rgba(57, 209, 227, 0.2)',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '24px',
        minHeight: '194px' // По дизайну Figma
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
        Daily activity
      </Typography>

      {/* График точек активности */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          height: '15px',
          marginBottom: '16px',
          paddingX: '4px'
        }}
      >
        {activityDots.map((dot) => (
          <Box
            key={dot.key}
            sx={{
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              borderRadius: '50%',
              backgroundColor: dot.color,
              flexShrink: 0
            }}
          />
        ))}
      </Box>

      {/* Прогресс-бары задач - 2 колонки по дизайну Figma */}
      <Box
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
              {/* Название задачи */}
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

              {/* Прогресс-бар */}
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
                {/* Заполненная часть */}
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
                
                {/* Индикатор прогресса */}
                {isCompleted ? (
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
                        color: '#ee449f',
                        fontSize: '8px',
                        fontWeight: 700,
                        fontFamily: 'SF Pro Rounded, -apple-system, BlinkMacSystemFont, sans-serif',
                        lineHeight: '6px'
                      }}
                    >
                      {task.current}/{task.total}
                    </Typography>
                  </Box>
                ) : (
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
                        color: '#ee449f', // По Figma всегда розовый для незавершенных
                        fontSize: '8px',
                        fontWeight: 700,
                        fontFamily: 'SF Pro Rounded, -apple-system, BlinkMacSystemFont, sans-serif',
                        lineHeight: '6px'
                      }}
                    >
                      {task.current}/{task.total}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Кнопка "CHECK ALL ACTIVITY" - высота 29px по дизайну Figma */}
      <Button
        onClick={handleCheckAll}
        sx={{
          width: '100%',
          backgroundColor: '#ee449f',
          borderRadius: '10px',
          height: '29px', // Фиксированная высота по дизайну Figma
          padding: 0,
          textTransform: 'none',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 800,
          fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
          lineHeight: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover': {
            backgroundColor: '#ee449f',
            filter: 'brightness(1.1)'
          }
        }}
      >
        CHECK ALL ACTIVITY
      </Button>
    </Box>
  );
};
