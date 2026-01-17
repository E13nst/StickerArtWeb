import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, Avatar, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { LeaderboardAuthor } from '@/types/sticker';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { AuthorsLeaderboardModal } from './AuthorsLeaderboardModal';

interface TopAuthorsProps {
  authors: LeaderboardAuthor[];
}

interface AuthorItemProps {
  author: LeaderboardAuthor;
  index: number;
}

const AuthorItem: React.FC<AuthorItemProps> = ({ author, index }) => {
  const navigate = useNavigate();
  const { avatarBlobUrl } = useUserAvatar(author.authorId);
  const firstName = author.firstName || '';
  const lastName = author.lastName || '';
  const displayName = firstName || author.username || `Автор #${author.authorId}`;
  const initials = getInitials(firstName, lastName || undefined);
  const avatarBgColor = getAvatarColor(firstName || author.username || 'Author');
  
  // Размеры аватаров по дизайну Figma: 1 место - 80px, 2-3 места - 60px
  const avatarSize = index === 0 ? 80 : 60;
  
  // Цвета бейджей по дизайну Figma
  const badgeColors = ['#ffc424', '#919191', '#db7f13'];
  const badgeColor = index < 3 ? badgeColors[index] : undefined;

  const handleClick = () => {
    navigate(`/author/${author.authorId}`);
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        py: 0.75,
        px: 1,
        width: index === 0 ? '80px' : '69px',
        cursor: 'pointer',
        transition: 'opacity 0.2s ease',
        '&:hover': {
          opacity: 0.8
        }
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

      {/* Информация об авторе */}
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
        
        {/* Количество созданных стикерсетов */}
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
          {author.publicCount} Create
        </Typography>
      </Box>
    </Box>
  );
};

export const TopAuthors: React.FC<TopAuthorsProps> = ({ authors }) => {
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
            Top Authors
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 1, mb: 2 }}>
            {/* Порядок: слева 2 место, в центре 1 место, справа 3 место */}
            {authors.length > 1 && (
              <AuthorItem key={authors[1].authorId} author={authors[1]} index={1} />
            )}
            {authors.length > 0 && (
              <AuthorItem key={authors[0].authorId} author={authors[0]} index={0} />
            )}
            {authors.length > 2 && (
              <AuthorItem key={authors[2].authorId} author={authors[2]} index={2} />
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

      <AuthorsLeaderboardModal open={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};

