import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box, Typography, Card, CardContent, Alert } from '@mui/material';
import StixlyTopHeader from '../components/StixlyTopHeader';
import { FloatingAvatar } from '../components/FloatingAvatar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { SimpleGallery } from '../components/SimpleGallery';
import { StickerPackModal } from '../components/StickerPackModal';
import { adaptStickerSetsToGalleryPacks } from '../utils/galleryAdapter';
import { apiClient } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { StickerSetResponse, ProfileResponse } from '../types/sticker';
import { UserInfo } from '../store/useProfileStore';

const computeStickerCount = (stickerSet: StickerSetResponse): number => {
  if (typeof (stickerSet as any).stickerCount === 'number') {
    return (stickerSet as any).stickerCount;
  }

  const info = stickerSet.telegramStickerSetInfo as any;

  if (!info) {
    return 0;
  }

  if (typeof info === 'string') {
    try {
      const parsed = JSON.parse(info);
      return Array.isArray(parsed?.stickers) ? parsed.stickers.length : 0;
    } catch {
      return 0;
    }
  }

  return Array.isArray(info?.stickers) ? info.stickers.length : 0;
};

const mapProfileToUserInfo = (profile: ProfileResponse): UserInfo => ({
  id: profile.userId,
  telegramId: profile.userId,
  username: profile.user?.username || undefined,
  firstName: profile.user?.firstName || undefined,
  lastName: profile.user?.lastName || undefined,
  avatarUrl: undefined,
  role: profile.role ?? 'USER',
  artBalance: profile.artBalance ?? 0,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
  telegramUserInfo: profile.user
    ? {
        user: {
          id: profile.user.id,
          is_bot: false,
          first_name: profile.user.firstName || '',
          last_name: profile.user.lastName || '',
          username: profile.user.username || '',
          language_code: profile.user.languageCode || '',
          is_premium: profile.user.isPremium ?? false
        },
        status: 'ok'
      }
    : undefined
});

export const AuthorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const authorId = id ? Number(id) : null;
  const { tg, initData, user, isInTelegramApp } = useTelegram();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const [stickerSets, setStickerSets] = useState<StickerSetResponse[]>([]);
  const [setsError, setSetsError] = useState<string | null>(null);
  const [isSetsLoading, setIsSetsLoading] = useState(false);

  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!tg?.BackButton) {
      return;
    }

    const handleBack = () => window.history.back();
    tg.BackButton.onClick(handleBack);
    tg.BackButton.show();

    return () => {
      if (tg?.BackButton) {
        tg.BackButton.hide();
      }
    };
  }, [tg]);

  useEffect(() => {
    if (!authorId || Number.isNaN(authorId)) {
      setProfile(null);
      setStickerSets([]);
      setProfileError('Некорректный идентификатор автора');
      setIsProfileLoading(false);
      setIsSetsLoading(false);
      return;
    }

    const effectiveInitData = initData || window.Telegram?.WebApp?.initData || '';
    if (effectiveInitData) {
      apiClient.setAuthHeaders(effectiveInitData, user?.language_code);
    } else {
      apiClient.checkExtensionHeaders();
    }

    let cancelled = false;

    setIsProfileLoading(true);
    setProfileError(null);
    setProfile(null);

    setIsSetsLoading(true);
    setSetsError(null);
    setStickerSets([]);

    const fetchData = async () => {
      try {
        const profileResponse = await apiClient.getProfileStrict(authorId);
        if (!cancelled) {
          setProfile(profileResponse);
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError('Не удалось загрузить профиль автора');
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }

      try {
        const aggregated: StickerSetResponse[] = [];
        let page = 0;
        const pageSize = 50;
        let continueFetching = true;

        while (continueFetching && !cancelled) {
          const response = await apiClient.getStickerSets(page, pageSize, { authorId });
          const chunk = response.content || [];
          aggregated.push(...chunk);

          const totalPages = response.totalPages ?? null;
          const isLast = response.last ?? (totalPages !== null ? page >= totalPages - 1 : chunk.length < pageSize);

          if (isLast || chunk.length === 0) {
            continueFetching = false;
          } else {
            page += 1;
            if (page > 200) {
              // защита от бесконечного цикла при некорректных данных сервера
              continueFetching = false;
            }
          }
        }

        if (!cancelled) {
          setStickerSets(aggregated);
        }
      } catch (error) {
        if (!cancelled) {
          setSetsError('Не удалось загрузить стикерсеты автора');
          setStickerSets([]);
        }
      } finally {
        if (!cancelled) {
          setIsSetsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [authorId, initData, user?.language_code]);

  const avatarUserInfo = useMemo<UserInfo | null>(() => {
    if (!profile) {
      return null;
    }
    return mapProfileToUserInfo(profile);
  }, [profile]);

  const displayName = useMemo(() => {
    if (!profile) {
      return null;
    }
    const username = profile.user?.username?.trim();
    if (username) {
      return `@${username}`;
    }
    const first = profile.user?.firstName?.trim();
    const last = profile.user?.lastName?.trim();
    const combined = [first, last].filter(Boolean).join(' ');
    return combined || null;
  }, [profile]);

  const authorRole = profile?.role ?? null;
  const isPremium = profile?.user?.isPremium ?? false;

  const totalStickers = useMemo(() => {
    return stickerSets.reduce((sum, set) => sum + computeStickerCount(set), 0);
  }, [stickerSets]);

  const packs = useMemo(() => adaptStickerSetsToGalleryPacks(stickerSets), [stickerSets]);

  const handlePackClick = (packId: string) => {
    const stickerSet = stickerSets.find((set) => set.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStickerSet(null);
  };

  if (!authorId || Number.isNaN(authorId)) {
    return null;
  }

  const packCount = stickerSets.length;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'var(--tg-theme-bg-color)',
        color: 'var(--tg-theme-text-color)',
        paddingBottom: isInTelegramApp ? 0 : 8,
        overflowX: 'hidden'
      }}
    >
      <StixlyTopHeader
        profileMode={{
          enabled: true,
          backgroundColor: isPremium
            ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          pattern: isPremium ? 'waves' : 'dots',
          content: isProfileLoading ? (
            <LoadingSpinner message="Загрузка профиля..." />
          ) : avatarUserInfo ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translate(-50%, 50%)',
                  zIndex: 20
                }}
              >
                <FloatingAvatar userInfo={avatarUserInfo} size="large" overlap={0} />
              </Box>
            </Box>
          ) : null
        }}
      />

      <Container maxWidth={isInTelegramApp ? 'sm' : 'lg'} sx={{ px: 2, mt: 0 }}>
        {profileError && (
          <Alert
            severity="error"
            sx={{
              mt: 2,
              mb: 2,
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-text-color)',
              border: '1px solid var(--tg-theme-border-color)'
            }}
          >
            {profileError}
          </Alert>
        )}

        {isProfileLoading ? (
          <LoadingSpinner message="Загрузка профиля..." />
        ) : profile ? (
          <Card
            sx={{
              borderRadius: 3,
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
              border: '1px solid var(--tg-theme-border-color, #e0e0e0)',
              boxShadow: 'none',
              pt: 0,
              pb: 2
            }}
          >
            <CardContent sx={{ pt: 6, color: 'var(--tg-theme-text-color, #000000)' }}>
              <Box sx={{ textAlign: 'center', mb: '0.618rem' }}>
                {displayName && (
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {displayName}
                  </Typography>
                )}
                {authorRole && (
                  <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
                    Role: {authorRole}
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2
                }}
              >
                <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                  <Typography
                    variant="h5"
                    fontWeight="bold"
                    sx={{ color: 'var(--tg-theme-button-color)' }}
                  >
                    {packCount}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
                    Наборов
                  </Typography>
                </Box>

                <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                  <Typography
                    variant="h5"
                    fontWeight="bold"
                    sx={{ color: 'var(--tg-theme-button-color)' }}
                  >
                    {totalStickers}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
                    Стикеров
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ) : null}
      </Container>

      <Container maxWidth={isInTelegramApp ? 'sm' : 'lg'} sx={{ px: 2 }}>
        {setsError && !isSetsLoading && (
          <Alert
            severity="error"
            sx={{
              mt: 2,
              mb: 2,
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-text-color)',
              border: '1px solid var(--tg-theme-border-color)'
            }}
          >
            {setsError}
          </Alert>
        )}

        {isSetsLoading ? (
          <LoadingSpinner message="Загрузка стикерсетов..." />
        ) : stickerSets.length === 0 ? (
          <EmptyState
            title="📁 Стикерсетов пока нет"
            message="У этого автора пока нет опубликованных стикерсетов"
          />
        ) : (
          <div className="fade-in">
            <SimpleGallery packs={packs} onPackClick={handlePackClick} enablePreloading={true} />
          </div>
        )}
      </Container>

      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
      />
    </Box>
  );
};