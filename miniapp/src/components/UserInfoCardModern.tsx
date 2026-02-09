import { FC } from 'react';
import { ShareIcon } from '@/components/ui/Icons';
import { Card, CardContent } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { Divider } from '@/components/ui/Divider';
import { UserInfo } from '@/store/useProfileStore';
import { getUserFullName, getUserTelegramId, getUserUsername, isUserPremium } from '@/utils/userUtils';

interface UserInfoCardModernProps {
  userInfo: UserInfo;
  onShareProfile?: () => void;
  onCustomizeBanner?: () => void;
}

export const UserInfoCardModern: FC<UserInfoCardModernProps> = ({
  userInfo,
  onShareProfile,
  onCustomizeBanner
}) => {
  const displayName = getUserFullName(userInfo);
  const username = getUserUsername(userInfo);
  const telegramId = getUserTelegramId(userInfo);
  const isPremium = isUserPremium(userInfo);

  return (
    <Card style={{ borderRadius: 12, backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)', color: 'var(--tg-theme-text-color, #000000)', border: '1px solid var(--tg-theme-border-color, #e0e0e0)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)', overflow: 'visible', marginTop: 32 }}>
      <CardContent style={{ padding: 24 }}>
        {/* Заголовок с именем и кнопкой поделиться */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          {/* Имя пользователя */}
          <Text variant="h3" as="h1" style={{ fontWeight: 'bold', fontSize: '1.5rem', textAlign: 'center' }}>
            {displayName}
          </Text>

          {/* Username / Handle */}
          {username && (
            <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color, #999999)', fontSize: '1rem', fontWeight: 500, textAlign: 'center' }}>
              @{username}
            </Text>
          )}

          {/* Premium badge */}
          {isPremium && (
            <Chip label="Premium" size="small" style={{ backgroundColor: 'var(--tg-theme-button-color, #2481cc)', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', height: 24 }} />
          )}
        </div>

        {/* Разделитель */}
        <Divider style={{ margin: '16px 0' }} />

        {/* Telegram ID и кнопка поделиться */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <Text variant="caption" style={{ color: 'var(--tg-theme-hint-color, #999999)', fontSize: '0.75rem' }}>
            Telegram ID: {telegramId}
          </Text>

          {onShareProfile && (
            <IconButton onClick={onShareProfile} size="small" style={{ color: 'var(--tg-theme-button-color, #2481cc)' }} aria-label="Поделиться профилем">
              <ShareIcon size={18} />
            </IconButton>
          )}
        </div>

        {/* Кнопка кастомизации баннера для premium */}
        {isPremium && onCustomizeBanner && (
          <div style={{ marginTop: 16 }}>
            <div
              onClick={onCustomizeBanner}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Text variant="bodySmall" style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                Настроить баннер
              </Text>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
