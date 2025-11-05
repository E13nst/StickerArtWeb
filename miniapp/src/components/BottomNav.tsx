import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  BottomNavigation, 
  BottomNavigationAction, 
  Paper,
  Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import CollectionsIcon from '@mui/icons-material/Collections';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface BottomNavProps {
  activeTab?: number;
  onChange?: (newValue: number) => void;
  isInTelegramApp?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChange
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [internalTab, setInternalTab] = React.useState<number>(0);

  // Определяем активную вкладку по маршруту
  const getCurrentTab = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') return 0;
    if (location.pathname === '/gallery') return 1;
    if (location.pathname.startsWith('/profile')) return 3;
    return typeof activeTab === 'number' ? activeTab : internalTab;
  };

  const handleNavigation = (_event: any, newValue: number) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalTab(newValue);
    }

    switch (newValue) {
      case 0:
        navigate('/dashboard');
        break;
      case 1:
        navigate('/gallery');
        break;
      case 2:
        navigate('/gallery'); // placeholder для магазина
        break;
      case 3:
        // Навигация к моему профилю
        navigate('/profile');
        break;
    }
  };

  return (
    <Paper 
      className="bottom-nav-paper"
      sx={{ 
        position: 'fixed', 
        bottom: 'calc(100vh * 0.024)', // ~2.4% отступ снизу (гармоничное значение)
        left: 'calc(100vw * 0.118)', // 11.8% отступ слева (для ширины 76.4%)
        right: 'calc(100vw * 0.118)', // 11.8% отступ справа (для ширины 76.4%)
        zIndex: 1000,
        overflow: 'hidden', // Обрезаем анимацию, выходящую за края
        // Фоллбэк для старых браузеров
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        // Современный способ: более прозрачный фон
        background: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 70%, transparent)',
        border: 'none',
        borderRadius: 'calc(100vw * 0.05)', // ~5% закругление углов (как у Telegram)
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        // Добавляем внутренний отступ для контента
        padding: 'calc(100vh * 0.006) 0', // ~0.6% вертикальный padding (уменьшено)
      }}
      elevation={0}
    >
      <BottomNavigation
        value={getCurrentTab()}
        onChange={handleNavigation}
        sx={{
          height: 'calc(100vh * 0.062)', // 6.2% от высоты viewport (гармоничное значение)
          minHeight: '52px',
          maxHeight: '64px',
          backgroundColor: 'transparent !important', // Принудительно прозрачный
          background: 'none !important', // Убираем любой background
          boxShadow: 'none',
          overflow: 'hidden', // Обрезаем анимацию кнопок
          '& .MuiBottomNavigationAction-root': {
            borderRadius: 'calc(100vw * 0.03)', // Закругление для анимации
            overflow: 'hidden', // Обрезаем ripple эффект
            color: 'var(--tg-theme-hint-color)',
            minWidth: 'auto',
            padding: 'calc(100vh * 0.004) calc(100vw * 0.02)', // padding из пропорций (уменьшено)
            backgroundColor: 'transparent !important',
            '&.Mui-selected': {
              color: 'var(--tg-theme-button-color)',
              backgroundColor: 'transparent !important',
              '& .MuiSvgIcon-root': {
                color: 'var(--tg-theme-button-color)',
                filter: 'drop-shadow(0 0 8px color-mix(in srgb, var(--tg-theme-button-color) 35%, transparent))',
              },
            },
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
            '& .MuiSvgIcon-root': {
              fontSize: 'calc(100vw * 0.055)', // ~5.5% от ширины viewport для иконок (уменьшено)
              minFontSize: '20px',
              maxFontSize: '26px',
            },
          },
        }}
      >
        <BottomNavigationAction 
          icon={<HomeIcon />} 
          slotProps={{ touchRipple: { center: true } }}
        />
        <BottomNavigationAction 
          icon={<CollectionsIcon />} 
          slotProps={{ touchRipple: { center: true } }}
        />
        <BottomNavigationAction 
          icon={<ShoppingCartIcon />} 
          slotProps={{ touchRipple: { center: true } }}
        />
        <BottomNavigationAction 
          icon={<AccountCircleIcon />} 
          slotProps={{ touchRipple: { center: true } }}
        />
      </BottomNavigation>
    </Paper>
  );
};
