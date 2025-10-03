import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { TelegramUser } from '@/types/telegram';

interface UserInfoProps {
  user: TelegramUser | null;
  isLoading?: boolean;
}

export const UserInfo: React.FC<UserInfoProps> = ({ user, isLoading = false }) => {
  if (isLoading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Загрузка информации о пользователе...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Пользователь не определен
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ 
      mb: 2,
      borderRadius: 4,
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      backgroundColor: '#ffffff',
      border: '1px solid rgba(0,0,0,0.05)'
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box textAlign="center">
          <Typography 
            variant="h6" 
            component="p" 
            sx={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#111827',
              mb: 1
            }}
          >
            Привет, <strong>{user.first_name}{user.last_name ? ` ${user.last_name}` : ''}</strong>!
          </Typography>
          <Typography 
            variant="body2" 
            sx={{
              color: '#6B7280',
              fontSize: '0.875rem'
            }}
          >
            Добро пожаловать в галерею стикеров
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
