import React from 'react';
;

interface StickerSetsTabsProps {
  activeTab: number;
  onChange: (newValue: number) => void;
  disabled?: boolean;
}

export const StickerSetsTabs: React.FC<StickerSetsTabsProps> = ({
  activeTab,
  onChange,
  disabled = false
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    if (disabled) return;
    onChange(newValue);
  };

  // Пропорции Фибоначчи для всех элементов
  const baseUnit = 1; // Базовый размер в rem
  const spacing = {
    tiny: `${0.236 * baseUnit}rem`,    // 0.236
    small: `${0.382 * baseUnit}rem`,   // 0.382
    medium: `${0.5 * baseUnit}rem`,     // 0.500
    golden: `${0.618 * baseUnit}rem`,  // 0.618
    large: `${0.764 * baseUnit}rem`    // 0.764
  };
  
  const dividerWidth = '1px'; // Толщина линии (как в ProfileTabs)
  const dividerColor = 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))';
  const dividerOpacity = 0.618; // Золотое сечение
  const dividerTop = '23.6%'; // 0.236 пропорция Фибоначчи
  const dividerBottom = '23.6%';

  return (
    <div sx={{ 
      width: '100%',
      mb: 0, // Убираем отступ снизу
      mt: 0, // Убираем отступ сверху
      pt: 0, // Убираем padding сверху
      backgroundColor: 'transparent',
      color: 'var(--tg-theme-text-color, #000000)',
      borderRadius: 0,
      borderTop: 'none',
      borderBottom: 'none', // Убираем горизонтальную линию снизу
      boxShadow: 'none',
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto'
    }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        variant="fullWidth"
        sx={{
          border: 'none',
          '& .MuiTabs-root': {
            border: 'none'
          },
          '& .MuiTab-root': {
            minHeight: 48,
            height: 48,
            maxHeight: 48,
            color: 'var(--tg-theme-hint-color, #999999)',
            transition: 'all 0.2s ease',
            minWidth: 0,
            flex: '1 1 0',
            padding: spacing.golden, // 0.618rem
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            '&:not(:last-child)::after': {
              content: '""',
              position: 'absolute',
              right: 0,
              top: dividerTop,
              bottom: dividerBottom,
              width: dividerWidth,
              backgroundColor: dividerColor,
              opacity: dividerOpacity
            },
            '&.Mui-selected': {
              color: 'var(--tg-theme-button-color, #2481cc)',
              fontWeight: 600
            },
            '&:hover': {
              color: 'var(--tg-theme-button-color, #2481cc)',
              opacity: 0.85
            }
          },
          '& .MuiTabs-indicator': {
            display: 'none' // Убираем стандартный индикатор
          }
        }}
      >
        <Tab
          disableRipple
          label="Загруженные"
          disabled={disabled}
        />
        <Tab
          disableRipple
          label="Понравившиеся"
          disabled={disabled}
        />
      </Tabs>
    </div>
  );
};
