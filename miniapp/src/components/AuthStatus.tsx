import { FC } from 'react';
import { AuthResponse } from '@/types/sticker';
import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';

interface AuthStatusProps {
  authStatus: AuthResponse | null;
  isLoading?: boolean;
  error?: string | null;
}

export const AuthStatus: FC<AuthStatusProps> = ({ 
  authStatus, 
  isLoading = false, 
  error = null 
}) => {
  if (isLoading) {
    return (
      <Card style={{ marginBottom: '1rem' }}>
        <CardContent>
          <Text 
            variant="bodySmall" 
            align="center"
            color="hint"
          >
            Проверка авторизации...
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ marginBottom: '1rem', borderLeft: '3px solid #f44336' }}>
        <CardContent>
          <Text variant="bodySmall" style={{ color: '#f44336' }}>
            ❌ Ошибка авторизации: {error}
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (!authStatus) {
    return (
      <Card style={{ marginBottom: '1rem', borderLeft: '3px solid #2196f3' }}>
        <CardContent>
          <Text variant="bodySmall" style={{ color: '#2196f3' }}>
            🌐 Режим браузера
            <br />Публичный доступ к API
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (authStatus.authenticated) {
    return (
      <Card style={{ marginBottom: '1rem', borderLeft: '3px solid #4caf50' }}>
        <CardContent>
          <Text variant="bodySmall" style={{ color: '#4caf50' }}>
            ✅ Аутентификация успешна
            <br />Роль: {authStatus.role || 'не определена'}
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: '1rem', borderLeft: '3px solid #f44336' }}>
      <CardContent>
        <Text variant="bodySmall" style={{ color: '#f44336' }}>
          ❌ Ошибка авторизации: {authStatus.message || 'Неизвестная ошибка'}
        </Text>
      </CardContent>
    </Card>
  );
};
