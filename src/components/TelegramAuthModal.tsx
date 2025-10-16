import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  TextField,
  Divider
} from '@mui/material';
import TelegramIcon from '@mui/icons-material/Telegram';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';

interface TelegramAuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthSuccess: (initData: string) => void;
  onAuthError?: (error: string) => void;
  onSkipAuth: () => void;
}

// Глобальная функция для обработки авторизации от Telegram Login Widget
declare global {
  interface Window {
    handleTelegramAuth: (user: any) => void;
  }
}

export const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({
  open,
  onClose,
  onAuthSuccess,
  onAuthError: _onAuthError,
  onSkipAuth
}) => {
  const [error, setError] = useState<string | null>(null);
  const [initData, setInitData] = useState<string>('');

  useEffect(() => {
    if (open) {
      setError(null);
      // Загружаем сохраненный initData из localStorage
      const savedInitData = localStorage.getItem('telegram_init_data');
      if (savedInitData) {
        setInitData(savedInitData);
      }
    }
  }, [open]);

  const handleManualAuth = () => {
    if (!initData.trim()) {
      setError('Введите initData');
      return;
    }

    // Сохраняем initData в localStorage
    localStorage.setItem('telegram_init_data', initData);
    
    onAuthSuccess(initData);
    onClose();
  };

  const handleLoadTestData = () => {
    // Тестовые данные для разработки
    const testInitData = 'query_id=test&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=' + Math.floor(Date.now() / 1000) + '&hash=test_hash';
    setInitData(testInitData);
  };

  const handleClearData = () => {
    setInitData('');
    localStorage.removeItem('telegram_init_data');
  };

  const renderContent = () => {
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <TelegramIcon sx={{ fontSize: 48, color: '#0088cc', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Авторизация через Telegram
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Для доступа к полному функционалу откройте приложение через Telegram бота
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}


        <Divider sx={{ my: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Режим разработки
          </Typography>
        </Divider>

        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="initData для тестирования"
            placeholder="Вставьте initData из Telegram Web App..."
            value={initData}
            onChange={(e) => setInitData(e.target.value)}
            variant="outlined"
            size="small"
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<DeveloperModeIcon />}
            onClick={handleLoadTestData}
          >
            Тестовые данные
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleClearData}
          >
            Очистить
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            onClick={handleManualAuth}
            disabled={!initData.trim()}
          >
            Войти с initData
          </Button>
          <Button
            variant="outlined"
            onClick={onSkipAuth}
          >
            Продолжить без авторизации
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Авторизация</DialogTitle>
      <DialogContent>
        {renderContent()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Отмена
        </Button>
      </DialogActions>
    </Dialog>
  );
};