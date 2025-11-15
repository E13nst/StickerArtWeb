import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SearchBar } from '../components/SearchBar';
import { SortButton } from '../components/SortButton';
import { getAvatarUrl } from '../utils/avatarUtils';

type AuthorProfile = ProfileResponse & { profilePhotoFileId?: string; profilePhotos?: any };

const PAGE_SIZE = 24;

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

const mapProfileToUserInfo = (profile: AuthorProfile): UserInfo => ({
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
  profilePhotoFileId: profile.profilePhotoFileId,
  profilePhotos: profile.profilePhotos,
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

const fetchAuthorPhoto = async (authorId: number) => {
  try {
    return await apiClient.getUserPhoto(authorId);
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const AuthorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const authorId = id ? Number(id) : null;
  const { tg, initData, user, isInTelegramApp } = useTelegram();

  const [profile, setProfile] = useState<AuthorProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const [stickerSets, setStickerSets] = useState<StickerSetResponse[]>([]);
  const [setsError, setSetsError] = useState<string | null>(null);
  const [isSetsLoading, setIsSetsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByLikes, setSortByLikes] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const isSearchActive = useMemo(() => searchTerm.trim().length > 0, [searchTerm]);

  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);
  
  const effectiveInitData = useMemo(() => initData || window.Telegram?.WebApp?.initData || '', [initData]);

  const fetchStickerSets = useCallback(
    async (page: number = 0, append: boolean = false) => {
      if (!authorId || Number.isNaN(authorId)) {
        return;
      }

      if (effectiveInitData) {
        apiClient.setAuthHeaders(effectiveInitData, user?.language_code);
      } else {
        apiClient.checkExtensionHeaders();
      }

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsSetsLoading(true);
        setSetsError(null);
      }

      try {
        const response = await apiClient.getStickerSets(page, PAGE_SIZE, {
          authorId,
          sort: sortByLikes ? 'likesCount' : 'createdAt',
          direction: 'DESC'
        });

        const content = response.content || [];

        setStickerSets((prev) => {
          if (!append) {
            return content;
          }
          const existingIds = new Set(prev.map((item) => item.id));
          const merged = [...prev];
          content.forEach((item) => {
            if (!existingIds.has(item.id)) {
              merged.push(item);
            }
          });
          return merged;
        });

        const resolvedPage = response.number ?? page;
        setCurrentPage(resolvedPage);

        if (typeof response.totalPages === 'number') {
          setTotalPages(response.totalPages);
        } else if (response.last === true) {
          setTotalPages(resolvedPage + 1);
        } else {
          setTotalPages((prev) => Math.max(prev, resolvedPage + 2));
        }

        if (typeof response.totalElements === 'number') {
          setTotalElements(response.totalElements);
        } else {
          setTotalElements((prev) => (append ? prev + content.length : content.length));
        }
      } catch (error) {
        if (!append) {
          setSetsError('Не удалось загрузить стикерсеты автора');
          setStickerSets([]);
          setCurrentPage(0);
          setTotalPages(0);
          setTotalElements(0);
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsSetsLoading(false);
        }
      }
    },
    [authorId, effectiveInitData, sortByLikes, user?.language_code]
  );

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
      setProfileError('Некорректный идентификатор автора');
      setIsProfileLoading(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      if (effectiveInitData) {
        apiClient.setAuthHeaders(effectiveInitData, user?.language_code);
      } else {
        apiClient.checkExtensionHeaders();
      }

      setIsProfileLoading(true);
      setProfileError(null);

      try {
        const profileResponse = await apiClient.getProfileStrict(authorId);
        const photo = await fetchAuthorPhoto(authorId);
        if (!cancelled) {
          setProfile({
            ...profileResponse,
            profilePhotoFileId: photo?.profilePhotoFileId,
            profilePhotos: photo?.profilePhotos
          });
        }
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setProfileError('Не удалось загрузить профиль автора');
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authorId, effectiveInitData, user?.language_code]);

  useEffect(() => {
    if (!authorId || Number.isNaN(authorId)) {
      setStickerSets([]);
      setCurrentPage(0);
      setTotalPages(0);
      setTotalElements(0);
      return;
    }

    setStickerSets([]);
    setCurrentPage(0);
    setTotalPages(0);
    setTotalElements(0);
    fetchStickerSets(0, false);
  }, [authorId, sortByLikes, fetchStickerSets]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (!profile || (!profile.profilePhotoFileId && !profile.profilePhotos)) {
      setAuthorAvatarUrl(null);
      return () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }

    const loadAvatar = async () => {
      try {
        if (effectiveInitData) {
          apiClient.setAuthHeaders(effectiveInitData, user?.language_code);
        } else {
          apiClient.checkExtensionHeaders();
        }
        
        // Выбираем оптимальный fileId из profilePhotos, если есть
        let optimalFileId = profile.profilePhotoFileId;
        if (profile.profilePhotos?.photos?.[0]?.[0]) {
          const photoSet = profile.profilePhotos.photos[0];
          const targetSize = 160;
          let bestPhoto = photoSet.find((p: any) => Math.min(p.width, p.height) >= targetSize);
          if (!bestPhoto) {
            bestPhoto = photoSet.reduce((max: any, p: any) => {
              const maxSize = Math.min(max.width, max.height);
              const photoSize = Math.min(p.width, p.height);
              return photoSize > maxSize ? p : max;
            });
          }
          optimalFileId = bestPhoto?.file_id || profile.profilePhotoFileId;
        }

        if (!optimalFileId) {
          setAuthorAvatarUrl(null);
          return;
        }

        // Используем getUserPhotoBlob вместо getSticker для фото профиля
        const userId = profile.userId;
        const blob = await apiClient.getUserPhotoBlob(userId, optimalFileId);
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setAuthorAvatarUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setAuthorAvatarUrl(null);
        }
      }
    };

    loadAvatar();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [profile?.profilePhotoFileId, profile?.profilePhotos, profile?.userId, effectiveInitData, user?.language_code]);

  const avatarUserInfo = useMemo<UserInfo | null>(() => {
    if (!profile) {
      return null;
    }
    const base = mapProfileToUserInfo(profile);
    // Используем загруженный blob URL, или getAvatarUrl с profilePhotos, или undefined
    const userId = base.id || base.telegramId;
    const avatarUrl = authorAvatarUrl ?? 
                      (userId && (base.profilePhotoFileId || base.profilePhotos)
                        ? getAvatarUrl(userId, base.profilePhotoFileId, base.profilePhotos, 160)
                        : undefined);
    return {
      ...base,
      avatarUrl
    };
  }, [profile, authorAvatarUrl]);

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

  const totalStickers = useMemo(() => {
    return stickerSets.reduce((sum, set) => sum + computeStickerCount(set), 0);
  }, [stickerSets]);

  const displayedStickerSets = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    let base = stickerSets;

    if (trimmed) {
      base = stickerSets.filter((set) => {
        const title = (set.title || '').toLowerCase();
        const name = (set.name || '').toLowerCase();
        return title.includes(trimmed) || name.includes(trimmed);
      });
    }

    if (sortByLikes) {
      return [...base].sort((a, b) => {
        const likesA = (a.likesCount ?? a.likes ?? 0);
        const likesB = (b.likesCount ?? b.likes ?? 0);
        return likesB - likesA;
      });
    }

    return base;
  }, [stickerSets, searchTerm, sortByLikes]);

  const packs = useMemo(() => adaptStickerSetsToGalleryPacks(displayedStickerSets), [displayedStickerSets]);

  const handlePackClick = (packId: string) => {
    const stickerSet = stickerSets.find((set) => set.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleStickerSetUpdated = useCallback((updated: StickerSetResponse) => {
    setSelectedStickerSet(updated);
    setStickerSets((prev) =>
      prev.map((set) => (set.id === updated.id ? { ...set, ...updated } : set))
    );
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStickerSet(null);
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSortToggle = useCallback(() => {
    setSortByLikes((prev) => !prev);
  }, []);

  const hasNextPage = useMemo(() => totalPages > 0 && currentPage < totalPages - 1, [totalPages, currentPage]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || isSetsLoading) {
      return;
    }
    if (!hasNextPage) {
      return;
    }
    fetchStickerSets(currentPage + 1, true);
  }, [currentPage, fetchStickerSets, hasNextPage, isLoadingMore, isSetsLoading]);

  if (!authorId || Number.isNaN(authorId)) {
    return null;
  }

  const packCount = totalElements || stickerSets.length;

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
        showThemeToggle={false}
        profileMode={{
          enabled: true,
          backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          pattern: 'dots',
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
        {setsError && !isSetsLoading && !isLoadingMore && (
          <Alert
            severity="error"
            sx={{
              mt: 2,
              mb: 2,
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              color: 'var(--tg-theme-text-color)',
              border: '1px солид var(--tg-theme-border-color)'
            }}
          >
            {setsError}
          </Alert>
        )}

        {isSetsLoading && stickerSets.length === 0 ? (
          <LoadingSpinner message="Загрузка стикерсетов..." />
        ) : displayedStickerSets.length === 0 ? (
          <EmptyState
            title={isSearchActive ? 'Поиск не дал результатов' : '📁 Стикерсетов пока нет'}
            message={
              isSearchActive
                ? `По запросу «${searchTerm.trim()}» ничего не найдено`
                : 'У этого автора пока нет опубликованных стикерсетов'
            }
          />
        ) : (
          <div className="fade-in">
            <SimpleGallery
              controlsElement={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.618rem', width: '100%', mt: '0.75rem' }}>
                  <Box sx={{ flex: 1 }}>
                    <SearchBar
                      value={searchTerm}
                      onChange={handleSearchChange}
                      onSearch={handleSearch}
                      placeholder="Поиск стикерсетов автора..."
                      disabled={isSetsLoading && stickerSets.length === 0}
                    />
                  </Box>
                  <SortButton
                    sortByLikes={sortByLikes}
                    onToggle={handleSortToggle}
                    disabled={(isSetsLoading && stickerSets.length === 0) || !!searchTerm}
                  />
                </Box>
              }
              packs={packs}
              onPackClick={handlePackClick}
              hasNextPage={hasNextPage}
              isLoadingMore={isLoadingMore}
              onLoadMore={hasNextPage ? handleLoadMore : undefined}
              enablePreloading={true}
              scrollMode="page"
              isRefreshing={isSetsLoading && stickerSets.length > 0}
            />
          </div>
        )}
      </Container>

      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
        onStickerSetUpdated={handleStickerSetUpdated}
      />
    </Box>
  );
};