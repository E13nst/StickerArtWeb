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

interface BottomNavProps {
  activeTab: number;
  onChange: (newValue: number) => void;
  isInTelegramApp?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChange
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Показываем нижнюю навигацию везде для лучшего UX

  // Определяем активную вкладку по маршруту
  const getCurrentTab = () => {
    if (location.pathname === '/') return 0;
    if (location.pathname.startsWith('/profile')) return 3;
    return activeTab;
  };

  const handleNavigation = (_event: any, newValue: number) => {
    onChange(newValue);

    switch (newValue) {
      case 0:
        navigate('/');
        break;
      case 1:
        // TODO: Навигация к странице стикеров
        console.log('Навигация к стикерам (не реализовано)');
        break;
      case 2:
        // TODO: Навигация к маркету
        console.log('Навигация к маркету (не реализовано)');
        break;
      case 3:
        // Навигация к моему профилю
        navigate('/profile');
        break;
    }
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(0, 0, 0, 0.05)',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
      }}
      elevation={0}
    >
      <BottomNavigation
        value={getCurrentTab()}
        onChange={handleNavigation}
        sx={{
          height: 64,
          backgroundColor: 'transparent',
          '& .MuiBottomNavigationAction-root': {
            color: '#6B7280',
            transition: 'all 0.2s ease',
            '&.Mui-selected': {
              color: '#00C6FF',
              transform: 'scale(1.1)',
            },
            '&:hover': {
              backgroundColor: 'rgba(0, 198, 255, 0.1)',
            },
            // Мобильные адаптации
            '@media (max-width: 400px)': {
              minWidth: '60px',
              '& .MuiSvgIcon-root': {
                fontSize: '1.4rem'
              }
            }
          },
        }}
      >
        <BottomNavigationAction 
          icon={<HomeIcon />}
        />
        <BottomNavigationAction 
          icon={<CollectionsIcon />}
        />
        <BottomNavigationAction 
          icon={<ShoppingCartIcon />}
        />
        <BottomNavigationAction 
          icon={<AccountCircleIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
};
