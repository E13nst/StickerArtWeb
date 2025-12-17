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

  const handleClick = () => {
    navigate(`/author/${author.authorId}`);
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.75,
        borderRadius: 2,
        backgroundColor: index === 0 ? 'var(--tg-theme-button-color)' : 'transparent',
        px: 1,
        transition: 'background-color 0.2s ease',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: index === 0 
            ? 'var(--tg-theme-button-color)' 
            : 'var(--tg-theme-secondary-bg-color)',
        }
      }}
    >
      {/* Аватар */}
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={avatarBlobUrl || undefined}
          sx={{
            width: 40,
            height: 40,
            bgcolor: avatarBgColor,
            fontSize: '0.875rem',
            fontWeight: 'bold'
          }}
        >
          {initials}
        </Avatar>
        {/* Бейдж места */}
        {index < 3 && (
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              color: '#000',
              border: '2px solid var(--tg-theme-bg-color)'
            }}
          >
            {index + 1}
          </Box>
        )}
      </Box>

      {/* Информация об авторе */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            color: index === 0 ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
            fontSize: '0.875rem',
            fontWeight: index === 0 ? 600 : 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {displayName}
        </Typography>
      </Box>

      {/* Количество публичных стикерсетов */}
      <Chip
        label={author.publicCount}
        size="small"
        sx={{
          height: '24px',
          fontSize: '0.7rem',
          backgroundColor: index === 0 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'var(--tg-theme-button-color)',
          color: index === 0 
            ? 'var(--tg-theme-button-text-color)' 
            : 'var(--tg-theme-button-text-color)',
          fontWeight: 600,
          minWidth: '40px'
        }}
      />
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
          borderRadius: 3,
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          border: '1px solid var(--tg-theme-border-color)',
          boxShadow: 'none',
          height: '100%'
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'var(--tg-theme-hint-color)',
              fontSize: '0.75rem',
              fontWeight: 500,
              mb: 1.5
            }}
          >
            Топ авторов стикерсетов
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {authors.map((author, index) => (
              <AuthorItem key={author.authorId} author={author} index={index} />
            ))}
          </Box>
          
          {/* Ссылка "Полный список" */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={handleOpenModal}
              variant="text"
              sx={{
                textTransform: 'none',
                textDecoration: 'underline',
                textDecorationColor: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.45))',
                fontSize: '0.82rem',
                fontWeight: 300,
                color: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.7))',
                px: 0,
                py: 0.5,
                minWidth: 'auto',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                  textDecorationColor: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.6))',
                  color: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.85))',
                },
              }}
            >
              Полный список
            </Button>
          </Box>
        </CardContent>
      </Card>

      <AuthorsLeaderboardModal open={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};

