import React from 'react';
;
import { ShareIcon } from '@/components/ui/Icons';;
import { UserInfo } from '@/store/useProfileStore';
import { getUserFirstName, getUserLastName, getUserFullName, getUserTelegramId, getUserUsername, isUserPremium } from '@/utils/userUtils';

interface UserInfoCardModernProps {
  userInfo: UserInfo;
  onShareProfile?: () => void;
  onCustomizeBanner?: () => void;
}

export const UserInfoCardModern: React.FC<UserInfoCardModernProps> = ({
  userInfo,
  onShareProfile,
  onCustomizeBanner
}) => {
  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  const displayName = getUserFullName(userInfo);
  const username = getUserUsername(userInfo);
  const telegramId = getUserTelegramId(userInfo);
  const isPremium = isUserPremium(userInfo);

  return (
    <Card
      sx={{
        borderRadius: 3,
        backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
        color: 'var(--tg-theme-text-color, #000000)',
        border: '1px solid var(--tg-theme-border-color, #e0e0e0)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        overflow: 'visible',
        mt: 4
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Заголовок с именем и кнопкой поделиться */}
        <div
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            mb: 2
          }}
        >
          {/* Имя пользователя */}
          <Typography
            variant="h5"
            component="h1"
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
              textAlign: 'center'
            }}
          >
            {displayName}
          </Typography>

          {/* Username / Handle */}
          {username && (
            <Typography
              variant="body2"
              sx={{
                color: 'var(--tg-theme-hint-color, #999999)',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontWeight: 500,
                textAlign: 'center'
              }}
            >
              @{username}
            </Typography>
          )}

          {/* Premium badge */}
          {isPremium && (
            <Chip
              label="Premium"
              size="small"
              sx={{
                backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                height: 24
              }}
            />
          )}
        </div>

        {/* Разделитель */}
        <div
          sx={{
            height: 1,
            backgroundColor: 'var(--tg-theme-border-color, #e0e0e0)',
            my: 2
          }}
        />

        {/* Telegram ID и кнопка поделиться */}
        <div
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'var(--tg-theme-hint-color, #999999)',
              fontSize: '0.75rem'
            }}
          >
            Telegram ID: {telegramId}
          </Typography>

          {onShareProfile && (
            <IconButton
              onClick={onShareProfile}
              size="small"
              sx={{
                color: 'var(--tg-theme-button-color, #2481cc)',
                '&:hover': {
                  backgroundColor: 'rgba(36, 129, 204, 0.1)'
                }
              }}
            >
              <ShareIcon fontSize="small" />
            </IconButton>
          )}
        </div>

        {/* Кнопка кастомизации баннера для premium */}
        {isPremium && onCustomizeBanner && (
          <div sx={{ mt: 2 }}>
            <div
              onClick={onCustomizeBanner}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                py: 1,
                px: 2,
                borderRadius: 2,
                backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                  opacity: 0.9,
                  transform: 'translateY(-1px)'
                },
                '&:active': {
                  transform: 'translateY(0)'
                }
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.875rem'
                }}
              >
                Настроить баннер
              </Typography>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

