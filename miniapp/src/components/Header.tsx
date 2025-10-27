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
  initData?: string | null;
  user?: any;
}

export const Header: React.FC<HeaderProps> = ({
  title = "🎨 Галерея стикеров",
  onMenuClick,
  onOptionsClick: _onOptionsClick,
  showMenu = true,
  showOptions = true,
  initData,
  user
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
      position="static" 
      color="primary"
      sx={{ 
        height: 56,
        minHeight: 56,
        backgroundColor: 'var(--tg-theme-button-color)',
        color: 'var(--tg-theme-button-text-color)'
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
            color="inherit"
            aria-label="menu"
            onClick={onMenuClick}
            sx={{ mr: 2 }}
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
              fontSize: '20px',
              fontWeight: 'bold',
              color: 'var(--tg-theme-button-text-color)'
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* Кнопка опций справа */}
        {showOptions && (
          <IconButton
            edge="end"
            color="inherit"
            aria-label="options"
            onClick={handleMenuClick}
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
          <MenuItem onClick={handleMenuClose}>
            Опции
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};