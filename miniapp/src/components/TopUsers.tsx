import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, Avatar, Button } from '@mui/material';
import { LeaderboardUser } from '@/types/sticker';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { LeaderboardModal } from './LeaderboardModal';

interface TopUsersProps {
  authors: LeaderboardUser[];
}

interface UserItemProps {
  author: LeaderboardUser;
  index: number;
}

const UserItem: React.FC<UserItemProps> = ({ author, index }) => {
  const { avatarBlobUrl } = useUserAvatar(author.userId);
  const firstName = author.firstName || '';
  const lastName = author.lastName || '';
  const displayName = firstName || author.username || `Пользователь #${author.userId}`;
  const initials = getInitials(firstName, lastName || undefined);
  const avatarBgColor = getAvatarColor(firstName || author.username || 'User');
  
  // Размеры аватаров по дизайну Figma: 1 место - 80px, 2-3 места - 60px
  const avatarSize = index === 0 ? 80 : 60;
  
  // Цвета бейджей по дизайну Figma
  const badgeColors = ['#ffc424', '#919191', '#db7f13'];
  const badgeColor = index < 3 ? badgeColors[index] : undefined;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        py: 0.75,
        px: 1,
        width: index === 0 ? '80px' : '69px'
      }}
    >
      {/* Аватар */}
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={avatarBlobUrl || undefined}
          sx={{
            width: avatarSize,
            height: avatarSize,
            bgcolor: avatarBgColor,
            fontSize: index === 0 ? '1rem' : '0.875rem',
            fontWeight: 'bold'
          }}
        >
          {initials}
        </Avatar>
        {/* Бейдж места */}
        {index < 3 && badgeColor && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: '50%',
              transform: 'translateX(50%)',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: badgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 400,
              color: '#ffffff',
              border: 'none',
              fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif'
            }}
          >
            {index + 1}
          </Box>
        )}
      </Box>

      {/* Информация о пользователе */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <Typography
          sx={{
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 400,
            fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            lineHeight: '22px'
          }}
        >
          {displayName}
        </Typography>
        
        {/* Количество добавленных стикеров */}
        <Typography
          sx={{
            color: '#67f56b',
            fontSize: '10px',
            fontWeight: 400,
            fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
            textAlign: 'center',
            lineHeight: '22px'
          }}
        >
          {author.publicCount} Added
        </Typography>
      </Box>
    </Box>
  );
};

export const TopUsers: React.FC<TopUsersProps> = ({ authors }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Card
        sx={{
          borderRadius: '16px',
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          height: '100%'
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Typography
            sx={{
              color: '#ffffff',
              fontSize: '24px',
              fontWeight: 700,
              fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
              mb: 1.5,
              lineHeight: '22px'
            }}
          >
            Top users
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 1, mb: 2 }}>
            {/* Порядок: слева 2 место, в центре 1 место, справа 3 место */}
            {authors.length > 1 && (
              <UserItem key={authors[1].userId} author={authors[1]} index={1} />
            )}
            {authors.length > 0 && (
              <UserItem key={authors[0].userId} author={authors[0]} index={0} />
            )}
            {authors.length > 2 && (
              <UserItem key={authors[2].userId} author={authors[2]} index={2} />
            )}
          </Box>
          
          {/* Ссылка "View all" */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={handleOpenModal}
              variant="text"
              sx={{
                textTransform: 'none',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 300,
                fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
                color: 'rgba(255, 255, 255, 0.5)',
                px: 0,
                py: 0,
                minWidth: 'auto',
                lineHeight: '28px',
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: 'rgba(255, 255, 255, 0.7)',
                },
              }}
            >
              View all
            </Button>
          </Box>
        </CardContent>
      </Card>

      <LeaderboardModal open={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};

