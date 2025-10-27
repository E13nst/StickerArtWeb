import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Avatar,
  Chip,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ShareIcon from '@mui/icons-material/Share';
import MessageIcon from '@mui/icons-material/Message';
import StarIcon from '@mui/icons-material/Star';
import { UserInfo } from '@/store/useProfileStore';
import { getAvatarUrl, getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { getUserFirstName, getUserLastName, getUserUsername, getUserFullName, isUserPremium, getUserTelegramId } from '@/utils/userUtils';

interface UserInfoCardProps {
  userInfo: UserInfo;
  isLoading?: boolean;
  onShareProfile?: () => void;
  onMessageUser?: () => void;
}

export const UserInfoCard: React.FC<UserInfoCardProps> = ({
  userInfo,
  isLoading = false,
  onShareProfile,
  onMessageUser
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [avatarError, setAvatarError] = useState(false);

  if (isLoading) {
    return (
      <Card sx={{ 
        mb: 1.5, // уменьшено с mb: 2 для экономии пространства
        borderRadius: 2, // уменьшено с 3 для компактности
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        color: 'var(--tg-theme-text-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: '0 2px 8px var(--tg-theme-shadow-color)'
      }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ 
              width: 64, 
              height: 64, 
              bgcolor: 'var(--tg-theme-hint-color)' 
            }}>
              <PersonIcon />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
                Загрузка информации о пользователе...
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Используем данные из telegramUserInfo (приоритетный источник)
  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  const displayName = getUserFullName(userInfo);
  const username = getUserUsername(userInfo);
  const isPremium = isUserPremium(userInfo);
  const telegramId = getUserTelegramId(userInfo);
  
  const avatarUrl = getAvatarUrl(userInfo.profilePhotoFileId) || userInfo.avatarUrl;
  const initials = getInitials(firstName, lastName);
  const avatarBgColor = getAvatarColor(firstName);

  return (
    <Card 
      sx={{ 
        mb: 1.5, // уменьшено с mb: 2 для экономии пространства
        borderRadius: 2, // уменьшено с 3 для компактности
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        color: 'var(--tg-theme-text-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: '0 2px 8px var(--tg-theme-shadow-color)', // уменьшено для компактности
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 16px var(--tg-theme-shadow-color)', // уменьшено для компактности
        }
      }}
    >
      <CardContent sx={{ p: isSmallScreen ? 2 : 3 }}>
        {/* Основная информация */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: isSmallScreen ? 'flex-start' : 'center',
          flexDirection: isSmallScreen ? 'column' : 'row',
          gap: 1.5, // уменьшено для компактности
          mb: 2 // уменьшено для компактности
        }}>
          {/* Аватар */}
          <Avatar 
            src={!avatarError ? avatarUrl : undefined}
            imgProps={{
              onError: () => setAvatarError(true),
              loading: 'lazy'
            }}
            sx={{ 
              width: isSmallScreen ? 48 : 56, // уменьшено для компактности
              height: isSmallScreen ? 48 : 56,
              bgcolor: avatarBgColor,
              fontSize: isSmallScreen ? '1.25rem' : '1.5rem', // уменьшено пропорционально
              fontWeight: 'bold',
              alignSelf: isSmallScreen ? 'center' : 'flex-start'
            }}
          >
            {initials}
          </Avatar>

          {/* Информация о пользователе */}
          <Box sx={{ 
            flexGrow: 1,
            textAlign: isSmallScreen ? 'center' : 'left'
          }}>
            {/* Имя и фамилия */}
            <Typography 
              variant={isSmallScreen ? 'h6' : 'h5'} 
              component="h2"
              sx={{ 
                fontWeight: 'bold',
                mb: 0.25, // уменьшено для компактности
                fontSize: isSmallScreen ? '1rem' : '1.25rem' // уменьшено для компактности
              }}
            >
              {displayName}
            </Typography>

            {/* Username */}
            {username && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 1,
                  fontSize: isSmallScreen ? '0.8rem' : '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  justifyContent: isSmallScreen ? 'center' : 'flex-start',
                  color: 'var(--tg-theme-hint-color)'
                }}
              >
                @{username}
                {isPremium && (
                  <StarIcon sx={{ fontSize: '1rem', color: 'var(--tg-theme-button-color)' }} />
                )}
              </Typography>
            )}

            {/* Роль */}
            <Chip 
              label={userInfo.role}
              size="small"
              variant="outlined"
              sx={{ 
                fontSize: isSmallScreen ? '0.7rem' : '0.75rem',
                height: isSmallScreen ? 20 : 24,
                color: 'var(--tg-theme-button-color)',
                borderColor: 'var(--tg-theme-button-color)',
                backgroundColor: 'transparent'
              }}
            />
          </Box>
        </Box>



        {/* Действия */}
        <Box sx={{ 
          mt: 2, 
          pt: 2, 
          borderTop: '1px solid',
          borderColor: 'var(--tg-theme-border-color)'
        }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 1,
            justifyContent: 'center'
          }}>
            {onShareProfile && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ShareIcon />}
                onClick={onShareProfile}
                sx={{ 
                  flex: 1,
                  fontSize: isSmallScreen ? '0.7rem' : '0.8rem'
                }}
              >
                Поделиться
              </Button>
            )}
            
            {onMessageUser && (
              <Button
                variant="contained"
                size="small"
                startIcon={<MessageIcon />}
                onClick={onMessageUser}
                sx={{ 
                  flex: 1,
                  fontSize: isSmallScreen ? '0.7rem' : '0.8rem'
                }}
              >
                Написать
              </Button>
            )}
          </Box>
        </Box>

        {/* Telegram ID */}
        <Box sx={{ 
          mt: 2, 
          pt: 2, 
          borderTop: '1px solid',
          borderColor: 'var(--tg-theme-border-color)'
        }}>
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: isSmallScreen ? '0.7rem' : '0.75rem',
              textAlign: 'center',
              display: 'block',
              color: 'var(--tg-theme-hint-color)'
            }}
          >
            Telegram ID: {telegramId}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
