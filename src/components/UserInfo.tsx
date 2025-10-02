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
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box textAlign="center">
          <Typography variant="h6" component="p" gutterBottom>
            Привет, <strong>{user.first_name}{user.last_name ? ` ${user.last_name}` : ''}</strong>!
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ID: <strong>{user.id}</strong>
          </Typography>
          {user.username && (
            <Typography variant="body2" color="text.secondary">
              Username: <strong>@{user.username}</strong>
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
