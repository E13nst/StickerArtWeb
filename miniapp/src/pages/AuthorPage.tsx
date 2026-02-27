import { useCallback, useEffect, useMemo, useState, FC } from 'react';
import { useParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { EmptyState } from '../components/EmptyState';
import { OptimizedGallery } from '../components/OptimizedGallery';
import { StickerPackModal } from '../components/StickerPackModal';
import { adaptStickerSetsToGalleryPacks } from '../utils/galleryAdapter';
import { apiClient } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { StickerSetResponse, ProfileResponse } from '../types/sticker';
import { UserInfo } from '../store/useProfileStore';
import { CompactControlsBar } from '../components/CompactControlsBar';
import { StickerSetType } from '../components/StickerSetTypeFilter';
import { Category } from '../components/CategoryFilter';
import { useScrollElement } from '../contexts/ScrollContext';
import { StixlyPageContainer } from '../components/layout/StixlyPageContainer';
import { getUserFullName } from '../utils/userUtils';
import { Text } from '../components/ui/Text';
import { OtherAccountBackground } from '../components/OtherAccountBackground';
import '../styles/common.css';
import '../styles/AuthorPage.css';

const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

type AuthorProfile = ProfileResponse & { profilePhotoFileId?: string; profilePhotos?: any };

const PAGE_SIZE = 24;

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeUsername = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  return value.startsWith('@') ? value.slice(1) : value;
};

const isValidProfileResponse = (value: unknown): value is ProfileResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as ProfileResponse;
  return typeof candidate.userId === 'number' && !!candidate.user && typeof candidate.user === 'object';
};

type FallbackAuthorData = {
  name: string | null;
  avatarUrl: string | null;
  userId: number | null;
};

const extractFallbackAuthorData = (set?: StickerSetResponse | null): FallbackAuthorData | null => {
  if (!set) {
    return null;
  }
  const extended = set as StickerSetResponse & {
    author?: {
      id?: number | string;
      userId?: number | string;
      username?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    };
    user?: {
      id?: number | string;
      userId?: number | string;
      username?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    };
    authorUsername?: string;
    authorFirstName?: string;
    authorLastName?: string;
    authorAvatarUrl?: string;
  };

  const username = normalizeUsername(
    toNonEmptyString(extended.username) ||
      toNonEmptyString(extended.authorUsername) ||
      toNonEmptyString(extended.author?.username) ||
      toNonEmptyString(extended.user?.username)
  );
  const firstName =
    toNonEmptyString(extended.firstName) ||
    toNonEmptyString(extended.authorFirstName) ||
    toNonEmptyString(extended.author?.firstName) ||
    toNonEmptyString(extended.user?.firstName);
  const lastName =
    toNonEmptyString(extended.lastName) ||
    toNonEmptyString(extended.authorLastName) ||
    toNonEmptyString(extended.author?.lastName) ||
    toNonEmptyString(extended.user?.lastName);
  const avatarUrl =
    toNonEmptyString(extended.avatarUrl) ||
    toNonEmptyString(extended.authorAvatarUrl) ||
    toNonEmptyString(extended.author?.avatarUrl) ||
    toNonEmptyString(extended.user?.avatarUrl);

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const name = fullName || (username ? `@${username}` : null);
  const userId =
    toNumericId(extended.userId) ||
    toNumericId(extended.author?.userId) ||
    toNumericId(extended.author?.id) ||
    toNumericId(extended.user?.userId) ||
    toNumericId(extended.user?.id) ||
    null;

  if (!name && !avatarUrl && !userId) {
    return null;
  }

  return {
    name,
    avatarUrl,
    userId
  };
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

const fetchAuthorPhoto = async (userId: number) => {
  try {
    return await apiClient.getUserPhoto(userId);
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
  const [profileRetryCount, setProfileRetryCount] = useState(0);
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

  // Фильтры для CompactControlsBar (упрощённые — без категорий и типов)
  const [selectedCategories] = useState<string[]>([]);
  const [categories] = useState<Category[]>([]);
  const [selectedStickerSetTypes] = useState<StickerSetType[]>([]);
  const [selectedStickerTypes] = useState<string[]>([]);
  const [selectedDate] = useState<string | null>('all');
  
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

  // Загрузка профиля автора
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
        // Основной сценарий: когда id в роуте совпадает с userId
        const profileResponseRaw = await apiClient.getProfileStrict(authorId);
        if (!isValidProfileResponse(profileResponseRaw)) {
          throw new Error('Invalid profile response payload');
        }
        const profileResponse = profileResponseRaw;
        const photo = await fetchAuthorPhoto(profileResponse.userId);
        if (!cancelled) {
          setProfile({
            ...profileResponse,
            profilePhotoFileId: photo?.profilePhotoFileId,
            profilePhotos: photo?.profilePhotos
          });
        }
      } catch (error) {
        // Fallback: /author/:id обычно содержит authorId, который может не совпадать с userId.
        // Пытаемся получить userId из первого стикерсета автора и загрузить профиль по нему.
        try {
          const firstPage = await apiClient.getStickerSetsByAuthor(authorId, 0, 1, 'createdAt', 'DESC', true);
          const fallbackUserId = extractFallbackAuthorData(firstPage.content?.[0])?.userId;

          if (typeof fallbackUserId === 'number' && !Number.isNaN(fallbackUserId)) {
            const profileResponseRaw = await apiClient.getProfileStrict(fallbackUserId);
            if (!isValidProfileResponse(profileResponseRaw)) {
              throw new Error('Invalid fallback profile response payload');
            }
            const profileResponse = profileResponseRaw;
            const photo = await fetchAuthorPhoto(profileResponse.userId);

            if (!cancelled) {
              setProfile({
                ...profileResponse,
                profilePhotoFileId: photo?.profilePhotoFileId,
                profilePhotos: photo?.profilePhotos
              });
              setProfileError(null);
            }
            return;
          }
        } catch {
          // Молча переходим к общему обработчику ошибки.
        }

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
  }, [authorId, effectiveInitData, user?.language_code, profileRetryCount]);

  // Загрузка аватара автора (blob)
  useEffect(() => {
    if (!profile || (!profile.profilePhotoFileId && !profile.profilePhotos)) {
      setAuthorAvatarUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const loadAvatar = async () => {
      try {
        if (effectiveInitData) {
          apiClient.setAuthHeaders(effectiveInitData, user?.language_code);
        } else {
          apiClient.checkExtensionHeaders();
        }
        
        let optimalFileId = profile.profilePhotoFileId;
        if (profile.profilePhotos?.photos?.[0]?.[0]) {
          const photoSet = profile.profilePhotos.photos[0];
          const targetSize = 160;
          let bestPhoto = photoSet.find((p: any) => Math.min(p.width, p.height) >= targetSize);
          if (!bestPhoto) {
            bestPhoto = photoSet.reduce((max: any, p: any) => {
              const photoSize = Math.min(p.width, p.height);
              return photoSize > Math.min(max.width, max.height) ? p : max;
            });
          }
          optimalFileId = bestPhoto?.file_id || profile.profilePhotoFileId;
        }

        if (!optimalFileId) {
          setAuthorAvatarUrl(null);
          return;
        }

        const blob = await apiClient.getUserPhotoBlob(profile.userId, optimalFileId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAuthorAvatarUrl(objectUrl);
      } catch {
        if (!cancelled) setAuthorAvatarUrl(null);
      }
    };

    loadAvatar();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.profilePhotoFileId, profile?.profilePhotos, profile?.userId, effectiveInitData, user?.language_code]);

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

  const displayName = useMemo(() => {
    if (!profile) {
      return null;
    }
    const userInfo = mapProfileToUserInfo(profile);
    const fullName = getUserFullName(userInfo);
    return fullName || null;
  }, [profile]);

  const fallbackAuthor = useMemo(() => {
    const candidate = stickerSets
      .map((set) => extractFallbackAuthorData(set))
      .find((entry): entry is FallbackAuthorData => !!entry);

    if (!candidate) {
      return null;
    }

    return {
      name: candidate.name || (candidate.userId ? `Автор #${candidate.userId}` : null),
      avatarUrl: candidate.avatarUrl || null
    };
  }, [stickerSets]);

  const resolvedDisplayName = displayName || fallbackAuthor?.name || (authorId ? `Автор #${authorId}` : '—');
  const resolvedAvatarUrl = authorAvatarUrl || fallbackAuthor?.avatarUrl || null;
  const shouldShowHeaderCard = Boolean(profile || fallbackAuthor || stickerSets.length > 0);

  const displayedStickerSets = useMemo(() => {
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

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    if (!authorId || Number.isNaN(authorId)) return;
    setCurrentPage(0);
    setTotalPages(0);
    setTotalElements(0);
    fetchStickerSets(0, false, value.trim() || undefined);
  }, [authorId, fetchStickerSets]);

  const handleSortToggle = useCallback(() => {
    setSortByLikes((prev) => !prev);
  }, []);

  const hasNextPage = useMemo(() => totalPages > 0 && currentPage < totalPages - 1, [totalPages, currentPage]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || isSetsLoading) return;
    if (!hasNextPage) return;
    fetchStickerSets(currentPage + 1, true, searchTerm);
  }, [currentPage, fetchStickerSets, hasNextPage, isLoadingMore, isSetsLoading, searchTerm]);

  if (!authorId || Number.isNaN(authorId)) {
    return null;
  }

  const packCount = totalElements || stickerSets.length;

  return (
    <div className={cn('page-container', 'author-page', isInTelegramApp && 'telegram-app')}>
      <OtherAccountBackground />
      {/* Шапка профиля автора — как account-header на MyProfilePage */}
      <div
        className={cn('account-header', isInTelegramApp && 'account-header--telegram')}
        data-figma-block="OTHER ACCOUNT"
      >
        {profileError && !isProfileLoading && (
          <div className="error-box">
            <ErrorDisplay
              error={profileError}
              onRetry={() => setProfileRetryCount((c) => c + 1)}
            />
          </div>
        )}

        {(isProfileLoading || (isSetsLoading && stickerSets.length === 0)) ? (
          <LoadingSpinner message="Загрузка..." />
        ) : shouldShowHeaderCard ? (
          <div className="account-header__card">
            {/* Аватар 80×80 внутри карточки (как на MyProfilePage) */}
            <div className="account-header__avatar">
              {resolvedAvatarUrl ? (
                <img src={resolvedAvatarUrl} alt="" />
              ) : (
                <Text variant="h2" weight="bold" style={{ color: '#fff' }}>
                  {(resolvedDisplayName || '?').slice(0, 1).toUpperCase()}
                </Text>
              )}
            </div>
            {/* Имя */}
            <Text variant="h2" weight="bold" className="account-header__name" as="div">
              {resolvedDisplayName}
            </Text>
            {/* Статистика */}
            <div className="account-header__stats">
              <div className="account-header__stat">
                <span className="account-header__stat-value">{packCount}</span>
                <span className="account-header__stat-label">sticker packs</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <StixlyPageContainer>
        {!isProfileLoading && (
          <div className="author-page__controls-sticky">
            <CompactControlsBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              onSearch={handleSearch}
              searchDisabled={false}
              categories={categories}
              selectedCategories={selectedCategories}
              onCategoryToggle={() => {}}
              categoriesDisabled={true}
              sortByLikes={sortByLikes}
              onSortToggle={handleSortToggle}
              sortDisabled={!!searchTerm}
              selectedStickerTypes={selectedStickerTypes}
              onStickerTypeToggle={() => {}}
              selectedStickerSetTypes={selectedStickerSetTypes}
              onStickerSetTypeToggle={() => {}}
              selectedDate={selectedDate}
              onDateChange={() => {}}
              variant="static"
            />
          </div>
        )}

        {setsError && !isSetsLoading && !isLoadingMore && (
          <div className="error-box">
            <ErrorDisplay
              error={setsError}
              onRetry={() => fetchStickerSets(0, false)}
            />
          </div>
        )}

        {displayedStickerSets.length === 0 && !isProfileLoading && !isSetsLoading ? (
          <EmptyState
            title={isSearchActive ? 'Поиск не дал результатов' : 'Стикерсетов пока нет'}
            message={
              isSearchActive
                ? `По запросу «${searchTerm.trim()}» ничего не найдено`
                : 'У этого автора пока нет опубликованных стикерсетов'
            }
          />
        ) : (
          <div className="u-fade-in" style={{ position: 'relative', zIndex: 1 }}>
            <OptimizedGallery
              packs={packs}
              onPackClick={handlePackClick}
              hasNextPage={hasNextPage}
              isLoadingMore={isLoadingMore}
              onLoadMore={hasNextPage ? handleLoadMore : undefined}
              scrollElement={scrollElement}
              variant="gallery"
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
