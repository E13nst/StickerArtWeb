import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Box,
  Menu,
  MenuItem
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
  onOptionsClick?: () => void;
  showMenu?: boolean;
  showOptions?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = "🎨 Галерея стикеров",
  onMenuClick,
  onOptionsClick,
  showMenu = true,
  showOptions = true
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  return (
    <AppBar 
      position="sticky" 
      className="fx-glass"
      sx={{ 
        backgroundColor: 'transparent !important',
        boxShadow: 'none',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        height: 56,
        minHeight: 56,
        borderRadius: '0 0 16px 16px', // смягченные нижние углы
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none'
      }}
    >
      <Toolbar 
        sx={{ 
          minHeight: '56px !important',
          paddingX: 2
        }}
      >
        {/* Кнопка меню слева */}
        {showMenu && (
          <IconButton
            edge="start"
            aria-label="menu"
            onClick={onMenuClick}
            sx={{ 
              mr: 2,
              color: '#6B7280',
              '&:hover': {
                backgroundColor: 'rgba(0, 198, 255, 0.1)',
                color: '#00C6FF'
              }
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Название по центру */}
        <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
          <Typography 
            variant="h6" 
            component="h1"
            sx={{ 
              fontSize: '16px',
              fontWeight: 600,
              color: '#111827'
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* Кнопка опций справа */}
        {showOptions && (
          <IconButton
            edge="end"
            aria-label="options"
            onClick={handleMenuClick}
            sx={{ 
              color: '#6B7280',
              '&:hover': {
                backgroundColor: 'rgba(0, 198, 255, 0.1)',
                color: '#00C6FF'
              }
            }}
          >
            <MoreVertIcon />
          </IconButton>
        )}

        {/* Выпадающее меню */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={onOptionsClick}>
            Настройки
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};
