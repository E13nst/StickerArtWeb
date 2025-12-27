import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Avatar } from '@mui/material';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';

interface TopAuthor {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  stickerCount: number;
  packCount: number;
}

interface TopAuthorsProps {
  authors: TopAuthor[];
}

interface AuthorItemProps {
  author: TopAuthor;
  index: number;
}

const AuthorItem: React.FC<AuthorItemProps> = ({ author, index }) => {
  const { avatarBlobUrl } = useUserAvatar(author.id);
  const firstName = author.firstName || '';
  const lastName = author.lastName || '';
  const displayName = firstName || author.username || `Пользователь #${author.id}`;
  const initials = getInitials(firstName, lastName || undefined);
  const avatarBgColor = getAvatarColor(firstName || author.username || 'User');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 0.75,
        borderRadius: 2,
        backgroundColor: index === 0 ? 'var(--tg-theme-button-color)' : 'transparent',
        px: 1,
        transition: 'background-color 0.2s ease'
      }}
    >
      {/* Аватар */}
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={avatarBlobUrl || author.avatarUrl || undefined}
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

      {/* Количество стикеров */}
      <Chip
        label={author.stickerCount}
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
  return (
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
          Топ-5 авторов
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {authors.map((author, index) => (
            <AuthorItem key={author.id} author={author} index={index} />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

