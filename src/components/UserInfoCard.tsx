import React from 'react';
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
import { UserInfo } from '@/store/useProfileStore';

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

  if (isLoading) {
    return (
      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'grey.300' }}>
              <PersonIcon />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Загрузка информации о пользователе...
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const displayName = `${userInfo.firstName}${userInfo.lastName ? ` ${userInfo.lastName}` : ''}`;

  return (
    <Card 
      sx={{ 
        mb: 2, 
        borderRadius: 3,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }
      }}
    >
      <CardContent sx={{ p: isSmallScreen ? 2 : 3 }}>
        {/* Основная информация */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: isSmallScreen ? 'flex-start' : 'center',
          flexDirection: isSmallScreen ? 'column' : 'row',
          gap: 2,
          mb: 3
        }}>
          {/* Аватар */}
          <Avatar 
            src={userInfo.avatarUrl} 
            sx={{ 
              width: isSmallScreen ? 56 : 64, 
              height: isSmallScreen ? 56 : 64,
              bgcolor: 'primary.main',
              fontSize: isSmallScreen ? '1.5rem' : '1.75rem',
              fontWeight: 'bold',
              alignSelf: isSmallScreen ? 'center' : 'flex-start'
            }}
          >
            {userInfo.firstName.charAt(0)}{userInfo.lastName?.charAt(0) || ''}
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
                mb: 0.5,
                fontSize: isSmallScreen ? '1.1rem' : '1.5rem'
              }}
            >
              {displayName}
            </Typography>

            {/* Username */}
            {userInfo.username && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  mb: 1,
                  fontSize: isSmallScreen ? '0.8rem' : '0.9rem'
                }}
              >
                @{userInfo.username}
              </Typography>
            )}

            {/* Роль */}
            <Chip 
              label={userInfo.role}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ 
                fontSize: isSmallScreen ? '0.7rem' : '0.75rem',
                height: isSmallScreen ? 20 : 24
              }}
            />
          </Box>
        </Box>



        {/* Действия */}
        <Box sx={{ 
          mt: 2, 
          pt: 2, 
          borderTop: '1px solid',
          borderColor: 'divider'
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
          borderColor: 'divider'
        }}>
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              fontSize: isSmallScreen ? '0.7rem' : '0.75rem',
              textAlign: 'center',
              display: 'block'
            }}
          >
            Telegram ID: {userInfo.telegramId}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
