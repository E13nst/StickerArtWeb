import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Avatar } from '@mui/material';

interface Author {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  stickerCount: number;
  packCount: number;
}

interface TopAuthorsProps {
  authors: Author[];
}

export const TopAuthors: React.FC<TopAuthorsProps> = ({ authors }) => {
  const getAuthorDisplayName = (author: Author) => {
    if (author.username) {
      return `@${author.username}`;
    }
    if (author.firstName) {
      return `${author.firstName}${author.lastName ? ` ${author.lastName}` : ''}`;
    }
    return `Автор #${author.id}`;
  };

  const getAuthorInitials = (author: Author) => {
    if (author.firstName) {
      return author.firstName.charAt(0).toUpperCase() + (author.lastName ? author.lastName.charAt(0).toUpperCase() : '');
    }
    if (author.username) {
      return author.username.charAt(0).toUpperCase();
    }
    return '?';
  };

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
            <Box
              key={author.id}
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
                  src={author.avatarUrl}
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: 'var(--tg-theme-button-color)',
                    fontSize: '0.875rem',
                    fontWeight: 'bold'
                  }}
                >
                  {getAuthorInitials(author)}
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
                  {getAuthorDisplayName(author)}
                </Typography>
              </Box>

              {/* Количество наборов */}
              <Chip
                label={author.packCount}
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
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

