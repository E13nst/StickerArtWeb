import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box, Typography, Card, CardContent } from '@mui/material';
import { apiClient } from '@/api/client';
import { useTelegram } from '@/hooks/useTelegram';
import { StickerSetResponse } from '@/types/sticker';

export const AuthorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const authorId = id ? Number(id) : null;
  const { initData, user } = useTelegram();

  const [username, setUsername] = useState<string | null>(null);
  const [stickerSets, setStickerSets] = useState<StickerSetResponse[]>([]);

  useEffect(() => {
    if (!authorId || Number.isNaN(authorId)) {
      setUsername(null);
      setStickerSets([]);
      return;
    }

    const effectiveInitData = initData || window.Telegram?.WebApp?.initData || '';
    apiClient.setAuthHeaders(effectiveInitData, user?.language_code);

    let isMounted = true;

    (async () => {
      try {
        const profile = await apiClient.getProfileStrict(authorId);
        if (!isMounted) {
          return;
        }
        const rawUsername = profile.user?.username?.trim();
        setUsername(rawUsername && rawUsername.length > 0 ? rawUsername : null);
      } catch {
        if (isMounted) {
          setUsername(null);
        }
      }
    })();

    (async () => {
      try {
        const response = await apiClient.getStickerSetsByAuthor(authorId, 0, 24);
        if (!isMounted) {
          return;
        }
        setStickerSets(response.content || []);
      } catch {
        if (isMounted) {
          setStickerSets([]);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [authorId, initData, user?.language_code]);

  if (!authorId || Number.isNaN(authorId)) {
    return null;
  }

  return (
    <Container maxWidth="sm" sx={{ py: 'calc(1rem * 0.618)' }}>
      {username && (
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            marginBottom: 'calc(1rem * 0.618)',
            fontSize: 'calc(1rem * 1.0)'
          }}
        >
          @{username}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 'calc(1rem * 0.382)',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
        }}
      >
        {stickerSets.map((set) => (
          <Card
            key={set.id}
            elevation={0}
            sx={{
              borderRadius: 'calc(1rem * 0.382)',
              border: '1px solid var(--tg-theme-border-color, rgba(0, 0, 0, 0.08))',
              backgroundColor: 'var(--tg-theme-secondary-bg-color, rgba(0, 0, 0, 0.04))'
            }}
          >
            <CardContent sx={{ p: 'calc(1rem * 0.5)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {set.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  marginTop: 'calc(1rem * 0.236)'
                }}
              >
                {set.name}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Container>
  );
};
