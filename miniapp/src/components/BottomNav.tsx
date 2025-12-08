import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  BottomNavigation, 
  BottomNavigationAction, 
  Paper
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import CollectionsIcon from '@mui/icons-material/Collections';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

const SOFT_ACCENT_COLORS = [
  'hsl(200 60% 70%)', // нежно-голубой
  'hsl(160 55% 68%)', // мятный
  'hsl(280 45% 72%)', // лавандовый
  'hsl(30 60% 72%)',  // персиковый
  'hsl(340 50% 72%)', // нежно-розовый
  'hsl(90 45% 65%)',  // пастельно-зелёный
  'hsl(220 40% 68%)', // серо-голубой
  'hsl(10 55% 70%)',  // дымчато-коралловый
];

const getRandomAccentColor = () => {
  const index = Math.floor(Math.random() * SOFT_ACCENT_COLORS.length);
  return SOFT_ACCENT_COLORS[index];
};

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
  const [activeColor, setActiveColor] = React.useState<string>(() => getRandomAccentColor());
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);

  // Определяем активную вкладку по маршруту
  const getCurrentTab = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') return 0;
    if (location.pathname === '/gallery') return 1;
    if (location.pathname === '/nft-soon') return 2;
    if (location.pathname.startsWith('/profile')) return 3;
    if (location.pathname === '/gallery2') return 4;
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
        navigate('/nft-soon');
        break;
      case 3:
        // Навигация к моему профилю
        navigate('/profile');
        break;
      case 4:
        navigate('/gallery2');
        break;
    }
  };

  React.useEffect(() => {
    setActiveColor(getRandomAccentColor());
  }, [location.pathname]);

  // Проверяем, открыто ли модальное окно
  React.useEffect(() => {
    const checkModalState = () => {
      const hasModalOpen = document.body.classList.contains('modal-open') || 
                          document.documentElement.classList.contains('modal-open');
      setIsModalOpen(hasModalOpen);
    };

    // Проверяем сразу
    checkModalState();

    // Создаем MutationObserver для отслеживания изменений классов
    const observer = new MutationObserver(checkModalState);
    
    // Наблюдаем за изменениями в body и html
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Скрываем навигацию, если модальное окно открыто
  if (isModalOpen) {
    return null;
  }

  return (
    <Paper 
      className="bottom-nav-paper"
      sx={{ 
        position: 'fixed', 
        bottom: 'calc(100vh * 0.024)', // ~2.4% отступ снизу (гармоничное значение)
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '600px', // узкий лейаут для основного контента
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
            padding: 'calc(100vh * 0.004) clamp(12px, 4vw, 20px)', // адаптивный горизонтальный отступ
            backgroundColor: 'transparent !important',
            flex: '1 1 0',
            '&.Mui-selected': {
              color: activeColor,
              backgroundColor: 'transparent !important',
              '& .MuiSvgIcon-root': {
                color: activeColor,
                filter: `drop-shadow(0 0 8px ${activeColor})`,
              },
            },
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
            },
            '& .MuiSvgIcon-root': {
              fontSize: 'clamp(22px, 5vw, 28px)',
            },
            '@media (min-width: 768px)': {
              padding: 'calc(100vh * 0.003) clamp(14px, 3vw, 18px)',
            },
            '@media (min-width: 1200px)': {
              padding: 'calc(100vh * 0.0025) 16px',
              '& .MuiSvgIcon-root': {
                fontSize: 'clamp(20px, 2vw, 26px)',
              },
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
        <BottomNavigationAction 
          icon={<ViewModuleIcon />} 
          slotProps={{ touchRipple: { center: true } }}
        />
      </BottomNavigation>
    </Paper>
  );
};
