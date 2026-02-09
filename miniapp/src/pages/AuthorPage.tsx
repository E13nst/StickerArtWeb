import { useCallback, useEffect, useMemo, useState, FC } from 'react';
import { useParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { OptimizedGallery } from '../components/OptimizedGallery';
import { StickerPackModal } from '../components/StickerPackModal';
import { adaptStickerSetsToGalleryPacks } from '../utils/galleryAdapter';
import { apiClient } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { StickerSetResponse, ProfileResponse } from '../types/sticker';
import { UserInfo } from '../store/useProfileStore';
import { SearchBar } from '../components/SearchBar';
import { SortButton } from '../components/SortButton';
import { useScrollElement } from '../contexts/ScrollContext';
import { StixlyPageContainer } from '../components/layout/StixlyPageContainer';
import { getUserFullName } from '../utils/userUtils';
import { Card, CardContent } from '../components/ui/Card';
import { Text } from '../components/ui/Text';
import { OtherAccountBackground } from '../components/OtherAccountBackground';
import '../styles/common.css';
import '../styles/AuthorPage.css';

// Утилита для объединения классов
const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

type AuthorProfile = ProfileResponse & { profilePhotoFileId?: string; profilePhotos?: any };

const PAGE_SIZE = 24;

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

export const AuthorPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const scrollElement = useScrollElement();
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
  const [, setAuthorAvatarUrl] = useState<string | null>(null);
  
  const effectiveInitData = useMemo(() => initData || window.Telegram?.WebApp?.initData || '', [initData]);

  const fetchStickerSets = useCallback(
    async (page: number = 0, append: boolean = false, searchQuery?: string) => {
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
        let response;
        
        // Если есть поисковый запрос, используем специальный эндпоинт поиска
        if (searchQuery && searchQuery.trim()) {
          response = await apiClient.searchAuthorStickerSets(
            authorId,
            searchQuery,
            page,
            PAGE_SIZE,
            true
          );
        } else {
          response = await apiClient.getStickerSetsByAuthor(
            authorId,
            page,
            PAGE_SIZE,
            sortByLikes ? 'likesCount' : 'createdAt',
            'DESC',
            true
          );
        }

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

  const displayName = useMemo(() => {
    if (!profile) {
      return null;
    }
    // Используем полное имя вместо username
    const userInfo = mapProfileToUserInfo(profile);
    const fullName = getUserFullName(userInfo);
    return fullName || null;
  }, [profile]);

  const displayedStickerSets = useMemo(() => {
    // Если есть активный поиск, то данные уже отфильтрованы на сервере
    // Локальная фильтрация не нужна
    if (sortByLikes) {
      return [...stickerSets].sort((a, b) => {
        const likesA = (a.likesCount ?? a.likes ?? 0);
        const likesB = (b.likesCount ?? b.likes ?? 0);
        return likesB - likesA;
      });
    }

    return stickerSets;
  }, [stickerSets, sortByLikes]);

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
    if (!authorId || Number.isNaN(authorId)) {
      return;
    }
    // Сбрасываем на первую страницу при поиске
    // НЕ очищаем stickerSets, чтобы SearchBar оставался видимым
    setCurrentPage(0);
    setTotalPages(0);
    setTotalElements(0);
    // Если строка поиска пустая, загружаем все стикерсеты, иначе выполняем поиск
    fetchStickerSets(0, false, value.trim() || undefined);
  }, [authorId, fetchStickerSets]);

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
    fetchStickerSets(currentPage + 1, true, searchTerm);
  }, [currentPage, fetchStickerSets, hasNextPage, isLoadingMore, isSetsLoading, searchTerm]);

  if (!authorId || Number.isNaN(authorId)) {
    return null;
  }

  const packCount = totalElements || stickerSets.length;

  return (
    <div className={cn('page-container', isInTelegramApp && 'telegram-app')}>
      <OtherAccountBackground />
      {/* OTHER ACCOUNT (Figma): шапка профиля автора */}
      <div
        className={cn('other-account', isInTelegramApp && 'other-account--telegram')}
        data-figma-block="OTHER ACCOUNT"
      >
        {profileError && (
          <div className="error-alert-inline" role="alert">
            <Text variant="body" color="default">{profileError}</Text>
          </div>
        )}

        {(isProfileLoading || (isSetsLoading && stickerSets.length === 0)) ? (
          <LoadingSpinner message="Загрузка..." />
        ) : profile ? (
          <Card className={cn('other-account__card', 'card-base', 'card-base-no-padding-top')}>
            <CardContent className="card-content-with-avatar">
              <div className={cn('other-account__name', 'text-center', 'relative', 'z-index-30')} style={{ marginBottom: '0.618rem', marginTop: '1rem' }}>
                {displayName && (
                  <Text variant="h4" weight="bold" className="typography-bold">
                    {displayName}
                  </Text>
                )}
              </div>

              <div className="flex-row-space-around">
                <div className="stat-box">
                  <Text variant="h3" weight="bold" className="stat-value">
                    {packCount}
                  </Text>
                  <Text variant="bodySmall" className="stat-label">
                    Наборов
                  </Text>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <StixlyPageContainer>
        {setsError && !isSetsLoading && !isLoadingMore && (
          <div className="error-alert-inline" role="alert">
            <Text variant="body" color="default">{setsError}</Text>
          </div>
        )}

        {/* SearchBar и SortButton всегда видны */}
        <div className="flex-row author-search-container">
          <div style={{ flex: 1 }}>
            <SearchBar
              value={searchTerm}
              onChange={handleSearchChange}
              onSearch={handleSearch}
              placeholder="Поиск стикерсетов автора..."
              disabled={isSetsLoading && stickerSets.length === 0}
            />
          </div>
          <SortButton
            sortByLikes={sortByLikes}
            onToggle={handleSortToggle}
            disabled={(isSetsLoading && stickerSets.length === 0) || !!searchTerm}
          />
        </div>

        {displayedStickerSets.length === 0 && !isProfileLoading && !isSetsLoading ? (
          <EmptyState
            title={isSearchActive ? 'Поиск не дал результатов' : '📁 Стикерсетов пока нет'}
            message={
              isSearchActive
                ? `По запросу «${searchTerm.trim()}» ничего не найдено`
                : 'У этого автора пока нет опубликованных стикерсетов'
            }
          />
        ) : (
          <div className="fade-in" style={{ position: 'relative', zIndex: 1 }}>
            <OptimizedGallery
              packs={packs}
              onPackClick={handlePackClick}
              hasNextPage={hasNextPage}
              isLoadingMore={isLoadingMore}
              onLoadMore={hasNextPage ? handleLoadMore : undefined}
              scrollElement={scrollElement}
            />
          </div>
        )}
      </StixlyPageContainer>

      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
        onStickerSetUpdated={handleStickerSetUpdated}
      />
    </div>
  );
};