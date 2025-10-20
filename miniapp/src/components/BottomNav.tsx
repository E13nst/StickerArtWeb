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
    if (location.pathname === '/') return 0;
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
        navigate('/');
        break;
      case 1:
        navigate('/'); // пока те же, можно заменить на /stickers, когда появится
        break;
      case 2:
        navigate('/'); // placeholder
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
        zIndex: 1000
      }}
      elevation={8}
    >
      <BottomNavigation
        value={getCurrentTab()}
        onChange={handleNavigation}
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            color: 'text.secondary',
            '&.Mui-selected': {
              color: 'primary.main',
            },
          },
        }}
      >
        <BottomNavigationAction 
          icon={<HomeIcon />}
          sx={{
            '&.Mui-selected': {
              '& .MuiSvgIcon-root': {
                color: 'primary.main',
              },
            },
          }}
        />
        <BottomNavigationAction 
          icon={<CollectionsIcon />}
          sx={{
            '&.Mui-selected': {
              '& .MuiSvgIcon-root': {
                color: 'primary.main',
              },
            },
          }}
        />
        <BottomNavigationAction 
          icon={<ShoppingCartIcon />}
          sx={{
            '&.Mui-selected': {
              '& .MuiSvgIcon-root': {
                color: 'primary.main',
              },
            },
          }}
        />
        <BottomNavigationAction 
          icon={<AccountCircleIcon />}
          sx={{
            '&.Mui-selected': {
              '& .MuiSvgIcon-root': {
                color: 'primary.main',
              },
            },
          }}
        />
      </BottomNavigation>
    </Paper>
  );
};
