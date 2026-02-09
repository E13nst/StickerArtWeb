import { FC } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { TelegramUser } from '@/types/telegram';

interface UserInfoProps {
  user: TelegramUser | null;
  isLoading?: boolean;
}

export const UserInfo: FC<UserInfoProps> = ({ user, isLoading = false }) => {
  if (isLoading) {
    return (
      <Card style={{ marginBottom: '1rem' }}>
        <CardContent>
          <Text variant="bodySmall" align="center" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Загрузка информации о пользователе...
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card style={{ marginBottom: '1rem' }}>
        <CardContent>
          <Text variant="bodySmall" align="center" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Пользователь не определен
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: '1rem' }}>
      <CardContent>
        <div style={{ textAlign: 'center' }}>
          <Text variant="h4" style={{ color: 'var(--tg-theme-text-color)', marginBottom: 8 }}>
            Привет, <strong>{user.first_name}{user.last_name ? ` ${user.last_name}` : ''}</strong>!
          </Text>
          <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color)', marginBottom: 4 }}>
            ID: <strong>{user.id}</strong>
          </Text>
          {user.username && (
            <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color)' }}>
              Username: <strong>@{user.username}</strong>
            </Text>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
