/**
 * ProfileHeader - шапка профиля с аватаром, именем и статистикой
 * Мемоизирован для предотвращения лишних re-renders
 */

import { memo, FC } from 'react';
import { AccountBalanceWalletIcon } from '@/components/ui/Icons';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { Avatar } from '@/components/ui/Avatar';
import { isUserPremium } from '@/utils/userUtils';

interface ProfileHeaderProps {
  userId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  artBalance?: number;
  avatarBlobUrl?: string | null;
  totalSets?: number;
  role?: string;
  isPremium?: boolean;
}

const ProfileHeaderComponent: FC<ProfileHeaderProps> = ({
  username,
  firstName,
  lastName,
  artBalance = 0,
  avatarBlobUrl,
  totalSets = 0,
  role,
  isPremium
}) => {
  const displayName = firstName || lastName 
    ? `${firstName || ''} ${lastName || ''}`.trim() 
    : username || 'Unknown User';
  
  const premium = isPremium ?? (role ? isUserPremium({ role } as any) : false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: 24, paddingTop: '16px'}}>
      {/* Аватар */}
      {avatarBlobUrl && (
        <Avatar src={avatarBlobUrl} size={120} />
      )}

      {/* Имя пользователя */}
      <div style={{ textAlign: 'center' }}>
        <Text variant="h3" style={{ fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '4px'}}>
          {displayName}
          {premium && (
            <span style={{ marginLeft: '8px', fontSize: '0.85em', color: 'var(--tg-theme-link-color)' }}>
              ⭐
            </span>
          )}
        </Text>
        
        {username && (
          <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color)', fontSize: '0.9rem' }}>
            @{username}
          </Text>
        )}
      </div>

      {/* Статистика */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Баланс ART */}
        <Chip
          label={
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px'}}>
              <AccountBalanceWalletIcon size={16} />
              {artBalance.toLocaleString()} ART
            </span>
          }
          size="medium"
          style={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)', fontWeight: 600, fontSize: '0.95rem', padding: '4px 8px' }}
        />

        {/* Количество стикерсетов */}
        <Chip
          label={`${totalSets} ${totalSets === 1 ? 'set' : 'sets'}`}
          size="medium"
          variant="outlined"
          style={{ borderColor: 'var(--tg-theme-hint-color)', color: 'var(--tg-theme-text-color)', fontWeight: 500 }}
        />
      </div>
    </div>
  );
};

const arePropsEqual = (prev: ProfileHeaderProps, next: ProfileHeaderProps): boolean => {
  return (
    prev.userId === next.userId &&
    prev.username === next.username &&
    prev.firstName === next.firstName &&
    prev.lastName === next.lastName &&
    prev.artBalance === next.artBalance &&
    prev.avatarBlobUrl === next.avatarBlobUrl &&
    prev.totalSets === next.totalSets &&
    prev.role === next.role &&
    prev.isPremium === next.isPremium
  );
};

export const ProfileHeader = memo(ProfileHeaderComponent, arePropsEqual);
