import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Box,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography as MuiTypography
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import BugReportIcon from '@mui/icons-material/BugReport';

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
  const [debugDialogOpen, setDebugDialogOpen] = useState(false);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleShowDebugInfo = () => {
    setDebugDialogOpen(true);
    handleMenuClose();
  };

  const handleCloseDebugDialog = () => {
    setDebugDialogOpen(false);
  };
  return (
    <AppBar 
      position="static" 
      color="primary"
      sx={{ 
        height: 56,
        minHeight: 56
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
              color: 'white'
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
          <MenuItem onClick={handleShowDebugInfo}>
            <BugReportIcon sx={{ mr: 1 }} />
            Показать initData
          </MenuItem>
        </Menu>

        {/* Модальное окно с отладочной информацией */}
        <Dialog
          open={debugDialogOpen}
          onClose={handleCloseDebugDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Отладочная информация</DialogTitle>
          <DialogContent>
            <MuiTypography variant="h6" gutterBottom>
              InitData:
            </MuiTypography>
            <Box
              component="pre"
              sx={{
                backgroundColor: 'grey.100',
                padding: 2,
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 400,
                fontSize: '0.8rem',
                fontFamily: 'monospace'
              }}
            >
              {initData || 'Нет данных'}
            </Box>
            
            {user && (
              <>
                <MuiTypography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Пользователь:
                </MuiTypography>
                <Box
                  component="pre"
                  sx={{
                    backgroundColor: 'grey.100',
                    padding: 2,
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: 200,
                    fontSize: '0.8rem',
                    fontFamily: 'monospace'
                  }}
                >
                  {JSON.stringify(user, null, 2)}
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDebugDialog}>
              Закрыть
            </Button>
          </DialogActions>
        </Dialog>
      </Toolbar>
    </AppBar>
  );
};
