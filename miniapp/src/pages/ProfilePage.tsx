import { useEffect, useState, useCallback, useRef, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore, UserInfo } from '@/store/useProfileStore';
import { useLikesStore } from '@/store/useLikesStore';
import { apiClient } from '@/api/client';
import { getUserFirstName, getUserFullName } from '@/utils/userUtils';
import { StickerSetResponse } from '@/types/sticker';

// UI Компоненты
import { Text } from '@/components/ui/Text';

// Компоненты
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { StickerPackModal } from '@/components/StickerPackModal';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';
import { OptimizedGallery } from '@/components/OptimizedGallery';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { openTelegramUrl } from '@/utils/openTelegramUrl';
import { useStickerFeed } from '@/hooks/useStickerFeed';
import { useScrollElement } from '@/contexts/ScrollContext';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import '@/styles/common.css';
import '@/styles/ProfilePage.css';

// Утилита для объединения классов
const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const ProfilePage: FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { tg, isInTelegramApp, initData } = useTelegram();
  const scrollElement = useScrollElement();

  const {
    isLoading,
    isUserLoading,
    isStickerSetsLoading,
    userInfo,
    userStickerSets,
    currentPage,
    totalPages,
    error,
    userError,
    stickerSetsError,
    setLoading,
    setUserLoading,
    setStickerSetsLoading,
    setUserInfo,
    setUserStickerSets,
    addUserStickerSets,
    setPagination,
    setError,
    setUserError,
    setStickerSetsError,
    getCachedProfile,
    setCachedProfile,
    isCacheValid
  } = useProfileStore();
  // ✅ FIX: Используем selector для предотвращения пересоздания функции
  const initializeLikes = useLikesStore(state => state.initializeLikes);

  // Локальное состояние
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStickerSet, setSelectedStickerSet] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState(0); // 0: стикерсеты, 1: стикеры, 2: поделиться
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleStickerSetUpdated = useCallback((updated: StickerSetResponse) => {
    setSelectedStickerSet(updated);
  }, []);

  // Валидация userId
  const userIdNumber = userId ? parseInt(userId, 10) : null;

  // Локальные переменные для синхронизации с хуком (объявляем до использования)
  const searchTermRef = useRef('');
  const sortByLikesRef = useRef(false);
  // Сохраняем позицию скролла для каждой вкладки
  const tabScrollOffsets = useRef<Record<number, number>>({});
  const prevActiveProfileTabRef = useRef(activeProfileTab);

  // Сохраняем и восстанавливаем позицию скролла при смене вкладки
  useEffect(() => {
    const prevTab = prevActiveProfileTabRef.current;
    if (prevTab === activeProfileTab) return;

    if (scrollElement) {
      tabScrollOffsets.current[prevTab] = scrollElement.scrollTop;
      const savedOffset = tabScrollOffsets.current[activeProfileTab] ?? 0;
      scrollElement.scrollTop = savedOffset;
    }
    prevActiveProfileTabRef.current = activeProfileTab;
  }, [activeProfileTab, scrollElement]);

  // Загрузка информации о пользователе
  const loadUserInfo = useCallback(async (id: number) => {
    setUserLoading(true);
    setUserError(null);

    try {
      // 1) получаем полный профиль через API /users/{userId}/profile
      const userProfile = await apiClient.getProfile(id);

      // 2) фото профиля /users/{id}/photo (404 -> null)
      let photo: { profilePhotoFileId?: string; profilePhotos?: any } | null = null;
      try {
        photo = await apiClient.getUserPhoto(userProfile.id);
      } catch (photoError: any) {
        // Игнорируем ошибки загрузки фото (404 - нормально, если фото нет)
        if (photoError?.response?.status !== 404) {
          console.warn('⚠️ Ошибка загрузки фото профиля:', photoError);
        }
      }

      // 3) объединяем данные профиля и фото
      const combined: UserInfo = {
        ...userProfile,
        profilePhotoFileId: photo?.profilePhotoFileId,
        profilePhotos: photo?.profilePhotos
      };

      console.log('✅ Информация о пользователе загружена:', {
        id: combined.id,
        username: combined.username,
        hasPhoto: !!combined.profilePhotoFileId,
        hasProfilePhotos: !!combined.profilePhotos,
        profilePhotosCount: combined.profilePhotos?.total_count || 0
      });
      
      setUserInfo(combined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки пользователя';
      setUserError(errorMessage);
      throw error;
    } finally {
      setUserLoading(false);
    }
  }, [setUserLoading, setUserError, setUserInfo]);

  // Загрузка стикерсетов пользователя
  const loadUserStickerSets = useCallback(async (
    id: number, 
    searchQuery?: string, 
    sortByLikesParam?: boolean,
    page: number = 0,
    isLoadMore: boolean = false
  ) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setStickerSetsLoading(true);
    }
    setStickerSetsError(null);

    try {
      let response;
      
      // Если есть поисковый запрос, используем специальный эндпоинт поиска
      if (searchQuery && searchQuery.trim()) {
        response = await apiClient.searchUserStickerSets(id, searchQuery, page, 20, true);
      } else {
        // Загружаем стикерсеты пользователя с пагинацией
        // При включенной сортировке по лайкам: сортировка по likesCount DESC (от самых лайкнутых)
        // При выключенной: сортировка по createdAt DESC (последние добавленные)
        const sortField = sortByLikesParam ? ('likesCount' as 'createdAt' | 'title' | 'name') : 'createdAt';
        response = await apiClient.getUserStickerSets(id, page, 20, sortField, 'DESC', true);
      }
      
      // Инициализируем лайки из загруженных данных
      // При загрузке дополнительных страниц используем mergeMode=true для защиты от перезаписи
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content, isLoadMore);
      }
      
      // Если включена сортировка по лайкам и это не поиск, сортируем локально по likesCount DESC
      let finalContent = response.content || [];
      if (sortByLikesParam && finalContent.length > 0 && !searchQuery) {
        finalContent = [...finalContent].sort((a, b) => {
          const likesA = a.likes || a.likesCount || 0;
          const likesB = b.likes || b.likesCount || 0;
          return likesB - likesA; // DESC - от самых лайкнутых
        });
      }
      
      if (isLoadMore) {
        // Добавляем новые стикерсеты к существующим
        console.log('➕ Добавляем стикерсеты:', {
          existingCount: useProfileStore.getState().userStickerSets.length,
          newCount: finalContent.length,
          totalAfter: useProfileStore.getState().userStickerSets.length + finalContent.length
        });
        addUserStickerSets(finalContent);
      } else {
        // Заменяем все стикерсеты
        console.log('🔄 Заменяем стикерсеты:', { count: finalContent.length });
        setUserStickerSets(finalContent);
      }
      
      // Обновляем пагинацию
      setPagination(
        response.number || page,
        response.totalPages || 0,
        response.totalElements || 0
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки стикерсетов';
      setStickerSetsError(errorMessage);
      throw error;
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setStickerSetsLoading(false);
      }
    }
  }, [setStickerSetsLoading, setStickerSetsError, setUserStickerSets, addUserStickerSets, setPagination, initializeLikes, setIsLoadingMore]);

  // Загрузка профиля пользователя с сервера (кэш проверяется в useEffect)
  const loadUserProfile = useCallback(async (id: number) => {
    console.log(`🌐 Загрузка профиля ${id} с сервера`);
    setLoading(true);
    
    try {
      // Параллельная загрузка данных пользователя и стикерсетов
      const [userResponse, stickerSetsResponse] = await Promise.allSettled([
        loadUserInfo(id),
        loadUserStickerSets(id, undefined, sortByLikesRef.current, 0, false)
      ]);

      // Проверяем результаты
      if (userResponse.status === 'rejected') {
        console.error('Ошибка загрузки пользователя:', userResponse.reason);
      }
      
      if (stickerSetsResponse.status === 'rejected') {
        console.error('Ошибка загрузки стикерсетов:', stickerSetsResponse.reason);
      }
      
      // Сохраняем в кэш только если оба запроса успешны
      if (userResponse.status === 'fulfilled' && stickerSetsResponse.status === 'fulfilled') {
        // Получаем текущие данные из store (они уже установлены в loadUserInfo и loadUserStickerSets)
        const currentUserInfo = useProfileStore.getState().userInfo;
        const currentStickerSets = useProfileStore.getState().userStickerSets;
        const currentPagination = {
          currentPage: useProfileStore.getState().currentPage,
          totalPages: useProfileStore.getState().totalPages,
          totalElements: useProfileStore.getState().totalElements
        };
        
        if (currentUserInfo && currentStickerSets) {
          setCachedProfile(id, currentUserInfo, currentStickerSets, currentPagination);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки профиля';
      setError(errorMessage);
      console.error('❌ Ошибка загрузки профиля:', error);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setCachedProfile, loadUserInfo, loadUserStickerSets]);
  
  useEffect(() => {
    if (!userIdNumber || isNaN(userIdNumber)) {
      setError('Некорректный ID пользователя');
      return;
    }

    // Очищаем предыдущие данные перед загрузкой новых
    // Это предотвращает мелькание старых данных
    setUserInfo(null);
    setUserStickerSets([]);

    // Проверяем кэш перед загрузкой
    if (isCacheValid(userIdNumber)) {
      const cached = getCachedProfile(userIdNumber);
      if (cached) {
        console.log(`📦 Профиль ${userIdNumber} уже в кэше, используем его`);
        setUserInfo(cached.userInfo);
        setUserStickerSets(cached.stickerSets);
        setPagination(cached.pagination.currentPage, cached.pagination.totalPages, cached.pagination.totalElements);
        
        // Инициализируем лайки
        if (cached.stickerSets.length > 0) {
          initializeLikes(cached.stickerSets);
        }
        return;
      }
    }

    // Устанавливаем заголовки авторизации, если есть initData
    if (initData) {
      apiClient.setAuthHeaders(initData);
    } else {
      apiClient.checkExtensionHeaders();
    }

    // НЕ вызываем reset() - это очищает кэш!
    loadUserProfile(userIdNumber);
  }, [userIdNumber, loadUserProfile]);

  // Обработчики действий
  const handleBack = () => {
    if (viewMode === 'detail') {
      setViewMode('list');
      setSelectedStickerSet(null);
    } else {
      navigate('/'); // Возврат на главную
    }
  };

  const handleViewStickerSet = (packId: string) => {
    const stickerSet = userStickerSets.find(s => s.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStickerSet(null);
  };

  const handleCreateSticker = () => {
    openTelegramUrl('https://t.me/StickerGalleryBot', tg);
  };

  // Загрузка следующей страницы
  const loadMoreStickerSets = useCallback(() => {
    if (!userIdNumber) return;
    if (currentPage < totalPages - 1 && !isLoadingMore) {
      console.log('🔄 Загрузка следующей страницы:', {
        currentPage,
        totalPages,
        isLoadingMore,
        currentStickerSetsCount: userStickerSets.length
      });
      loadUserStickerSets(userIdNumber, undefined, sortByLikesRef.current, currentPage + 1, true);
    }
  }, [userIdNumber, currentPage, totalPages, isLoadingMore, loadUserStickerSets, userStickerSets.length]);

  // Обработчик поиска
  const handleSearch = useCallback((query: string) => {
    if (!userIdNumber) return;
    searchTermRef.current = query;
    if (query.trim()) {
      loadUserStickerSets(userIdNumber, query, sortByLikesRef.current, 0, false);
    } else {
      loadUserStickerSets(userIdNumber, undefined, sortByLikesRef.current, 0, false);
    }
  }, [userIdNumber, loadUserStickerSets]);

  // Обработчик изменения сортировки
  const handleSortChange = useCallback((sortByLikes: boolean) => {
    if (!userIdNumber) return;
    sortByLikesRef.current = sortByLikes;
    loadUserStickerSets(userIdNumber, searchTermRef.current || undefined, sortByLikes, 0, false);
  }, [userIdNumber, loadUserStickerSets]);

  // Используем хук для унификации логики ленты стикеров
  const stickerFeed = useStickerFeed({
    currentPage,
    totalPages,
    isLoading: isStickerSetsLoading,
    isLoadingMore,
    onLoadMore: loadMoreStickerSets,
    onSearch: handleSearch,
    onSortChange: handleSortChange,
    searchPlaceholder: 'Поиск стикерсетов пользователя...',
    disableSortCondition: false,
  });

  // Синхронизируем refs с хуком
  useEffect(() => {
    searchTermRef.current = stickerFeed.searchTerm;
    sortByLikesRef.current = stickerFeed.sortByLikes;
  }, [stickerFeed.searchTerm, stickerFeed.sortByLikes]);

  // Фильтрация стикерсетов (при поиске данные уже отфильтрованы на сервере)
  const filteredStickerSets = userStickerSets;

  // Вычисляемые состояния загрузки (как в GalleryPage)
  const isInitialLoading = isStickerSetsLoading && userStickerSets.length === 0 && !stickerSetsError;

  // Обработка кнопки "Назад" в Telegram
  useEffect(() => {
    if (tg?.BackButton) {
      tg.BackButton.onClick(handleBack);
      tg.BackButton.show();
    }

    return () => {
      if (tg?.BackButton) {
        tg.BackButton.hide();
      }
    };
  }, [tg, viewMode]);

  console.log('🔍 ProfilePage состояние:', {
    userId: userIdNumber,
    userInfo: userInfo?.firstName,
    stickerSetsCount: userStickerSets.length,
    filteredCount: filteredStickerSets.length,
    isLoading,
    viewMode
  });

  // Основные ошибки
  if (error) {
    return (
      <div className="error-page-container">
        <StixlyPageContainer className="error-container">
          <div className="error-alert" role="alert">
            <Text variant="body" color="default">{error}</Text>
          </div>
          <EmptyState
            title="❌ Ошибка"
            message="Не удалось загрузить профиль пользователя"
            actionLabel="Вернуться на главную"
            onAction={() => navigate('/')}
          />
        </StixlyPageContainer>
      </div>
    );
  }

  return (
    <div className={cn('page-container', 'profile-page', isInTelegramApp && 'telegram-app')}>
      <OtherAccountBackground />
      {/* Карточка профиля под header (Header Panel в MainLayout) */}
      <StixlyPageContainer className="page-container-no-margin-top">
        {isUserLoading ? (
          <LoadingSpinner message="Загрузка профиля..." />
        ) : userInfo ? (
          <>
            {/* Карточка со статистикой */}
            <div className={cn('card-base', 'card-base-no-padding-top')}>
              <div className="card-content-with-avatar">
                {/* Имя пользователя */}
                <div className="profile-username-container">
                  <Text 
                    variant="h2" 
                    weight="bold"
                    className="profile-username"
                  >
                    {getUserFullName(userInfo)}
                  </Text>
                  {userInfo.username && (
                    <Text 
                      variant="bodySmall"
                      className="profile-handle"
                    >
                      @{userInfo.username}
                    </Text>
                  )}
                </div>

                {/* Статистика */}
                <div className="flex-row-space-around">
                  <div className="stat-box">
                    <Text 
                      variant="h2" 
                      weight="bold"
                      className="stat-value"
                    >
                      {userStickerSets.length}
                    </Text>
                    <Text 
                      variant="bodySmall"
                      className="stat-label"
                    >
                      Наборов
                    </Text>
                  </div>
                  
                  <div className="stat-box">
                    <Text 
                      variant="h2" 
                      weight="bold"
                      className="stat-value"
                    >
                      {userStickerSets.reduce((sum, set) => sum + (set.stickerCount || 0), 0)}
                    </Text>
                    <Text 
                      variant="bodySmall"
                      className="stat-label"
                    >
                      Стикеров
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {!isUserLoading && userError && !userInfo && (
          <div className="error-box">
            <ErrorDisplay
              error={userError}
              onRetry={() => userIdNumber && loadUserInfo(userIdNumber)}
            />
          </div>
        )}

        {/* Вкладки профиля (вне карточки, стили как Create/Likes/Upload) */}
        {userInfo && (
          <div className="profile-page-tabs-wrap">
            <ProfileTabs
              activeTab={activeProfileTab}
              onChange={setActiveProfileTab}
              isInTelegramApp={isInTelegramApp}
            />
          </div>
        )}
      </StixlyPageContainer>

      {/* Прокручиваемый контент */}
      <StixlyPageContainer>
        {viewMode === 'list' ? (
          <>

            {/* Контент вкладок */}
            <TabPanel value={activeProfileTab} index={0}>
              {/* Контент стикерсетов */}
              {isInitialLoading ? (
                <LoadingSpinner message="Загрузка стикерсетов..." />
              ) : stickerSetsError ? (
                <ErrorDisplay 
                  error={stickerSetsError} 
                  onRetry={() => userIdNumber && loadUserStickerSets(userIdNumber, undefined, stickerFeed.sortByLikes, 0, false)} 
                />
              ) : filteredStickerSets.length === 0 ? (
                <EmptyState
                  title="📁 Стикерсетов пока нет"
                  message={
                    stickerFeed.searchTerm 
                      ? 'По вашему запросу ничего не найдено' 
                      : userInfo && getUserFirstName(userInfo)
                        ? `У ${getUserFirstName(userInfo)} пока нет созданных стикерсетов`
                        : 'У этого пользователя пока нет стикерсетов'
                  }
                  actionLabel="Создать стикер"
                  onAction={handleCreateSticker}
                />
              ) : (
                <div className="u-fade-in">
                  <OptimizedGallery
                    packs={adaptStickerSetsToGalleryPacks(filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                    hasNextPage={!stickerFeed.searchTerm && currentPage < totalPages - 1}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={loadMoreStickerSets}
                    scrollElement={scrollElement}
                    variant="gallery"
                  />
                </div>
              )}
            </TabPanel>

            <TabPanel value={activeProfileTab} index={1}>
              {/* Список всех стикеров пользователя */}
              <EmptyState
                title="🎨 Все стикеры"
                message="Здесь будут отображаться все стикеры пользователя"
                actionLabel="Создать стикер"
                onAction={handleCreateSticker}
              />
            </TabPanel>

            <TabPanel value={activeProfileTab} index={2}>
              {/* Достижения пользователя */}
              <div className="achievements-container">
                <Text variant="h3" className="achievements-title">
                  Достижения
                </Text>

                <div className="achievements-list">
                  <div className="achievement-badge">
                    Сеты: {userStickerSets.length}
                  </div>
                  <div className="achievement-badge">
                    Стикеры: {userStickerSets.reduce((s, set) => s + (set.stickerCount || 0), 0)}
                  </div>
                </div>

                <Text variant="bodySmall" className="achievements-description">
                  Больше достижений скоро: streak, лайки, топ‑автор и др.
                </Text>
              </div>
            </TabPanel>
          </>
        ) : null}
      </StixlyPageContainer>

      {/* Модалка деталей стикерсета */}
      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
        onStickerSetUpdated={handleStickerSetUpdated}
      />
    </div>
  );
};
