import React from 'react';
import { Card, CardContent, Typography, Alert } from '@mui/material';
import { AuthResponse } from '@/types/sticker';

interface AuthStatusProps {
  authStatus: AuthResponse | null;
  isLoading?: boolean;
  error?: string | null;
}

export const AuthStatus: React.FC<AuthStatusProps> = ({ 
  authStatus, 
  isLoading = false, 
  error = null 
}) => {
  if (isLoading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Проверка авторизации...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="error">
            ❌ Ошибка авторизации: {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!authStatus) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="info">
            🌐 Режим браузера
            <br />Публичный доступ к API
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (authStatus.authenticated) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="success">
            ✅ Аутентификация успешна
            <br />Роль: {authStatus.role || 'не определена'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Alert severity="error">
          ❌ Ошибка авторизации: {authStatus.message || 'Неизвестная ошибка'}
        </Alert>
      </CardContent>
    </Card>
  );
};
