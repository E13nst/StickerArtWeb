/**
 * ProfileHeader - шапка профиля с аватаром, именем и статистикой
 * Мемоизирован для предотвращения лишних re-renders
 */

import React, { memo } from 'react';
import { AccountBalanceWalletIcon } from '@/components/ui/Icons';
;
import { FloatingAvatar } from './FloatingAvatar';
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

const ProfileHeaderComponent: React.FC<ProfileHeaderProps> = ({
  userId,
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
  
  const premium = isPremium ?? (role ? isUserPremium(role) : false);

  return (
    <div
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        paddingTop: 2
      }}
    >
      {/* Аватар */}
      <FloatingAvatar
        userId={userId}
        username={username}
        photoUrl={avatarBlobUrl}
        size={120}
      />

      {/* Имя пользователя */}
      <div sx={{ textAlign: 'center' }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: 'var(--tg-theme-text-color)',
            mb: 0.5
          }}
        >
          {displayName}
          {premium && (
            <span
              style={{
                marginLeft: '8px',
                fontSize: '0.85em',
                color: 'var(--tg-theme-link-color)'
              }}
            >
              ⭐
            </span>
          )}
        </Typography>
        
        {username && (
          <Typography
            variant="body2"
            sx={{
              color: 'var(--tg-theme-hint-color)',
              fontSize: '0.9rem'
            }}
          >
            @{username}
          </Typography>
        )}
      </div>

      {/* Статистика */}
      <div
        sx={{
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}
      >
        {/* Баланс ART */}
        <Chip
          icon={<AccountBalanceWalletIcon />}
          label={`${artBalance.toLocaleString()} ART`}
          size="medium"
          sx={{
            backgroundColor: 'var(--tg-theme-button-color)',
            color: 'var(--tg-theme-button-text-color)',
            fontWeight: 600,
            fontSize: '0.95rem',
            padding: '4px 8px',
            '& .MuiChip-icon': {
              color: 'var(--tg-theme-button-text-color)'
            }
          }}
        />

        {/* Количество стикерсетов */}
        <Chip
          label={`${totalSets} ${totalSets === 1 ? 'set' : 'sets'}`}
          size="medium"
          variant="outlined"
          sx={{
            borderColor: 'var(--tg-theme-hint-color)',
            color: 'var(--tg-theme-text-color)',
            fontWeight: 500
          }}
        />
      </div>
    </div>
  );
};

// Кастомная функция сравнения для оптимизации
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

