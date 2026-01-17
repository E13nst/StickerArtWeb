import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  BottomNavigation, 
  BottomNavigationAction, 
  Paper
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import CollectionsIcon from '@mui/icons-material/Collections';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useTelegram } from '@/hooks/useTelegram';

// Цвет активной вкладки согласно дизайну Figma
const ACTIVE_COLOR = '#ee449f'; // Розовый для Swipe

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
  const { tg } = useTelegram();
  const [internalTab, setInternalTab] = React.useState<number>(0);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [inactiveColor, setInactiveColor] = React.useState<string>('#ffffff');
  const [backgroundColor, setBackgroundColor] = React.useState<string>('rgba(255, 255, 255, 0.2)');
  
  // Функция для определения цвета неактивных элементов
  const updateInactiveColor = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      const textColor = computedStyle.getPropertyValue('--tg-theme-text-color').trim();
      if (textColor) {
        setInactiveColor(textColor);
        return;
      }
      
      // Fallback на основе colorScheme
      const isLight = tg?.colorScheme === 'light' || 
                     root.classList.contains('tg-light-theme') ||
                     (!root.classList.contains('tg-dark-theme') && 
                      window.matchMedia('(prefers-color-scheme: light)').matches);
      setInactiveColor(isLight ? '#000000' : '#ffffff');
    }
  }, [tg?.colorScheme]);
  
  // Функция для определения цвета фона
  const updateBackgroundColor = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      const bgColor = getComputedStyle(root).getPropertyValue('--tg-theme-bg-color').trim();
      if (bgColor) {
        // Для светлой темы используем темный фон с прозрачностью, для темной - светлый
        const isLight = bgColor.toLowerCase() === '#ffffff' || 
                       bgColor.toLowerCase() === 'rgb(255, 255, 255)' ||
                       tg?.colorScheme === 'light' ||
                       root.classList.contains('tg-light-theme');
        setBackgroundColor(isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.2)');
        return;
      }
    }
    setBackgroundColor('rgba(255, 255, 255, 0.2)');
  }, [tg?.colorScheme]);
  
  // Обновляем цвета при монтировании и изменении темы
  React.useEffect(() => {
    updateInactiveColor();
    updateBackgroundColor();
    
    // Слушаем изменения темы
    const observer = new MutationObserver(() => {
      updateInactiveColor();
      updateBackgroundColor();
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    // Слушаем изменения системной темы
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleThemeChange = () => {
      updateInactiveColor();
      updateBackgroundColor();
    };
    mediaQuery.addEventListener('change', handleThemeChange);
    
    // Слушаем события изменения темы Telegram
    tg?.onEvent?.('themeChanged', () => {
      updateInactiveColor();
      updateBackgroundColor();
    });
    
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleThemeChange);
      tg?.offEvent?.('themeChanged', () => {
        updateInactiveColor();
        updateBackgroundColor();
      });
    };
  }, [updateInactiveColor, updateBackgroundColor, tg]);

  // Определяем активную вкладку по маршруту
  const getCurrentTab = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') return 0;
    if (location.pathname === '/gallery') return 1;
    if (location.pathname === '/nft-soon') return 2;
    if (location.pathname === '/generate') return 3;
    if (location.pathname.startsWith('/profile')) return 4;
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
        navigate('/generate');
        break;
      case 4:
        // Навигация к моему профилю
        navigate('/profile');
        break;
    }
  };


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

  const currentTab = getCurrentTab();

  return (
    <Paper 
      className="bottom-nav-paper"
      sx={{ 
        position: 'fixed', 
        bottom: 'calc(100vh * 0.024)', // ~2.4% отступ снизу
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '600px',
        zIndex: 'var(--z-header, 100)',
        overflow: 'hidden',
        // Фон адаптируется под тему
        backgroundColor: backgroundColor,
        border: 'none',
        borderRadius: '16px', // Согласно дизайну Figma
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        padding: '0',
      }}
      elevation={0}
    >
      <BottomNavigation
        value={currentTab}
        onChange={handleNavigation}
        showLabels
        sx={{
          height: '50px', // Согласно дизайну Figma
          backgroundColor: 'transparent !important',
          boxShadow: 'none',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '4px 8px',
            color: `${inactiveColor} !important`,
            flex: '1 1 0',
            '&.Mui-selected': {
              color: ACTIVE_COLOR,
              '& .MuiSvgIcon-root': {
                color: `${ACTIVE_COLOR} !important`,
              },
              '& .MuiBottomNavigationAction-label': {
                color: `${ACTIVE_COLOR} !important`,
                fontSize: '8px',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 400,
                marginTop: '2px',
              },
            },
            '& .MuiSvgIcon-root': {
              fontSize: '24px',
              color: `${inactiveColor} !important`,
              transition: 'color 0.3s ease',
            },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '8px',
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 400,
            color: `${inactiveColor} !important`,
            marginTop: '2px',
            transition: 'color 0.3s ease',
            '&.Mui-selected': {
              color: `${ACTIVE_COLOR} !important`,
            },
          },
          },
        }}
      >
        <BottomNavigationAction 
          icon={<HomeIcon />}
          label="Home"
        />
        <BottomNavigationAction 
          icon={<CollectionsIcon />}
          label="Gallery"
        />
        <BottomNavigationAction 
          icon={<FavoriteIcon />}
          label="Swipe"
        />
        <BottomNavigationAction 
          icon={<AutoAwesomeIcon />}
          label="Generation"
        />
        <BottomNavigationAction 
          icon={<AccountCircleIcon />}
          label="Account"
        />
      </BottomNavigation>
    </Paper>
  );
};
