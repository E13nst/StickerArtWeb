import React, { useState } from 'react';
import { Button, Box, Typography, Alert } from '@mui/material';
import TelegramIcon from '@mui/icons-material/Telegram';

interface TelegramAuthButtonProps {
  onAuthSuccess: (initData: string) => void;
  onAuthError: (error: string) => void;
}

export const TelegramAuthButton: React.FC<TelegramAuthButtonProps> = ({
  onAuthSuccess,
  onAuthError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTelegramAuth = () => {
    setIsLoading(true);
    setError(null);

    // Создаем URL для авторизации через Telegram
    const botUsername = 'StickerGallery'; // Замените на ваш бот
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    const telegramAuthUrl = `https://t.me/${botUsername}?startapp=${btoa(redirectUrl)}`;

    console.log('🔗 Telegram Auth URL:', telegramAuthUrl);

    // Открываем Telegram для авторизации
    window.open(telegramAuthUrl, '_blank');

    // Слушаем сообщения от Telegram Web App
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://web.telegram.org') {
        return;
      }

      if (event.data.type === 'telegram-auth') {
        const { initData } = event.data;
        if (initData) {
          console.log('✅ Получен initData от Telegram:', initData);
          onAuthSuccess(initData);
          window.removeEventListener('message', handleMessage);
        } else {
          console.error('❌ initData не получен от Telegram');
          onAuthError('Не удалось получить данные авторизации от Telegram');
          window.removeEventListener('message', handleMessage);
        }
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Таймаут для авторизации
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      setIsLoading(false);
      if (!error) {
        setError('Время ожидания авторизации истекло');
      }
    }, 60000); // 60 секунд
  };

  return (
    <Box sx={{ textAlign: 'center', p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Авторизация через Telegram
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Для доступа к полному функционалу приложения необходимо авторизоваться через Telegram
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        startIcon={<TelegramIcon />}
        onClick={handleTelegramAuth}
        disabled={isLoading}
        sx={{
          backgroundColor: '#0088cc',
          '&:hover': {
            backgroundColor: '#006699',
          },
        }}
      >
        {isLoading ? 'Авторизация...' : 'Войти через Telegram'}
      </Button>

      <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
        Нажмите кнопку, чтобы открыть Telegram и авторизоваться
      </Typography>
    </Box>
  );
};
