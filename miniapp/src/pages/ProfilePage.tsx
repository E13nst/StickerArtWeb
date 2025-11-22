import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box,
  Alert,
  Typography,
  Card,
  CardContent
} from '@mui/material';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore, UserInfo } from '@/store/useProfileStore';
import { useLikesStore } from '@/store/useLikesStore';
import { apiClient } from '@/api/client';
import { getUserUsername, isUserPremium } from '@/utils/userUtils';
import { StickerSetResponse } from '@/types/sticker';

// Компоненты
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { FloatingAvatar } from '@/components/FloatingAvatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { StickerSetDetail } from '@/components/StickerSetDetail';
import { StickerPackModal } from '@/components/StickerPackModal';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';
import { SimpleGallery } from '@/components/SimpleGallery';
import { DebugPanel } from '@/components/DebugPanel';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { useStickerFeed } from '@/hooks/useStickerFeed';

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { tg, user, isInTelegramApp, initData } = useTelegram();

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
    isCacheValid,
    reset
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

  // Загрузка информации о пользователе
  const loadUserInfo = useCallback(async (id: number) => {
    setUserLoading(true);
    setUserError(null);

    try {
      // 1) получаем полный профиль через API /profiles/{userId}
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
        const sortField = sortByLikesParam ? 'likesCount' : 'createdAt';
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

  const handleShareStickerSet = (name: string, _title: string) => {
    if (tg) {
      tg.openTelegramLink(`https://t.me/addstickers/${name}`);
    } else {
      window.open(`https://t.me/addstickers/${name}`, '_blank');
    }
  };

  const handleLikeStickerSet = (id: number, title: string) => {
    // TODO: Реализовать API для лайков
    console.log(`Лайк стикерсета: ${title} (ID: ${id})`);
    alert(`Лайк для "${title}" будет реализован в будущем!`);
  };

  const handleCreateSticker = () => {
    if (tg) {
      tg.openTelegramLink('https://t.me/StickerGalleryBot');
    } else {
      window.open('https://t.me/StickerGalleryBot', '_blank');
    }
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
  const isRefreshing = isStickerSetsLoading && userStickerSets.length > 0;

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
      <Box sx={{ 
        minHeight: '100vh', 
        backgroundColor: 'var(--tg-theme-bg-color)',
        color: 'var(--tg-theme-text-color)'
      }}>
        <Container maxWidth="lg" sx={{ py: 2 }}>
          <Alert severity="error" sx={{ 
            mb: 2,
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            border: '1px solid var(--tg-theme-border-color)'
          }}>
            {error}
          </Alert>
          <EmptyState
            title="❌ Ошибка"
            message="Не удалось загрузить профиль пользователя"
            actionLabel="Вернуться на главную"
            onAction={() => navigate('/')}
          />
        </Container>
      </Box>
    );
  }

  // Проверка premium статуса для оформления баннера
  const isPremium = userInfo ? isUserPremium(userInfo) : false;

  return (
    <Box sx={{ 
      width: '100%',
      minHeight: '100vh', 
      backgroundColor: 'var(--tg-theme-bg-color)',
      color: 'var(--tg-theme-text-color)',
      paddingBottom: isInTelegramApp ? 0 : 8,
      overflowX: 'hidden',
      overflowY: 'visible'
    }}>
      {/* Профильный header */}
      <StixlyTopHeader
        showThemeToggle={false}
        profileMode={{
          enabled: true,
          backgroundColor: isPremium 
            ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' 
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          pattern: isPremium ? 'waves' : 'dots',
          content: isUserLoading ? (
            <LoadingSpinner message="Загрузка профиля..." />
          ) : userInfo ? (
            <Box sx={{ 
              width: '100%', 
              height: '100%',
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Аватар наполовину на header */}
              <Box sx={{ 
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translate(-50%, 50%)',
                zIndex: 20
              }}>
                <FloatingAvatar userInfo={userInfo} size="large" overlap={0} />
              </Box>
            </Box>
          ) : null
        }}
      />

      {/* Карточка профиля под аватаром (как в MyProfile) */}
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, mt: 0 }}>
        {isUserLoading ? (
          <LoadingSpinner message="Загрузка профиля..." />
        ) : userInfo ? (
          <>
            {/* Карточка со статистикой */}
            <Card sx={{ 
              borderRadius: 3,
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
              border: '1px solid var(--tg-theme-border-color, #e0e0e0)',
              boxShadow: 'none',
              pt: 0,
              pb: 2
            }}>
              <CardContent sx={{ pt: 6, color: 'var(--tg-theme-text-color, #000000)' }}>
                {/* Статистика */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-around', 
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2
                }}>
                  <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                    <Typography 
                      variant="h5" 
                      fontWeight="bold"
                      sx={{ color: 'var(--tg-theme-button-color)' }}
                    >
                      {userStickerSets.length}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ color: 'var(--tg-theme-hint-color)' }}
                    >
                      Наборов
                    </Typography>
                  </Box>
                  
                  <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                    <Typography 
                      variant="h5" 
                      fontWeight="bold"
                      sx={{ color: 'var(--tg-theme-button-color)' }}
                    >
                      {userStickerSets.reduce((sum, set) => sum + (set.stickerCount || 0), 0)}
                    </Typography>
                    <Typography 
                      variant="body2"
                      sx={{ color: 'var(--tg-theme-hint-color)' }}
                    >
                      Стикеров
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </>
        ) : null}

        {/* Ошибка пользователя */}
        {userError && (
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
            {userError}
          </Alert>
        )}

        {/* Вкладки профиля */}
        {userInfo && (
          <ProfileTabs
            activeTab={activeProfileTab}
            onChange={setActiveProfileTab}
            isInTelegramApp={isInTelegramApp}
          />
        )}
      </Container>

      {/* Прокручиваемый контент */}
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2 }}>
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
                      : userInfo && getUserUsername(userInfo)
                        ? `У @${getUserUsername(userInfo)} пока нет созданных стикерсетов`
                        : 'У этого пользователя пока нет стикерсетов'
                  }
                  actionLabel="Создать стикер"
                  onAction={handleCreateSticker}
                />
              ) : (
                <div className="fade-in">
                  <SimpleGallery
                    controlsElement={stickerFeed.controlsElement}
                    packs={adaptStickerSetsToGalleryPacks(filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                    hasNextPage={!stickerFeed.searchTerm && currentPage < totalPages - 1}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={loadMoreStickerSets}
                    enablePreloading={true}
                    scrollMode="page"
                    isRefreshing={isRefreshing}
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
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                alignItems: 'center',
                py: 4
              }}>
                <Typography 
                  variant="h6" 
                  textAlign="center" 
                  sx={{ 
                    mb: 1,
                    color: 'var(--tg-theme-text-color)'
                  }}
                >
                  Достижения
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    Сеты: {userStickerSets.length}
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    Стикеры: {userStickerSets.reduce((s, set) => s + (set.stickerCount || 0), 0)}
                  </Box>
                </Box>

                <Typography 
                  variant="body2" 
                  textAlign="center"
                  sx={{ color: 'var(--tg-theme-hint-color)' }}
                >
                  Больше достижений скоро: streak, лайки, топ‑автор и др.
                </Typography>
              </Box>
            </TabPanel>
          </>
        ) : null}
      </Container>

      {/* Debug панель */}
      {initData && <DebugPanel initData={initData} />}

      {/* Модалка деталей стикерсета (мок) */}
      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
        onLike={(id) => {
          useLikesStore.getState().toggleLike(String(id));
        }}
        onStickerSetUpdated={handleStickerSetUpdated}
      />
    </Box>
  );
};
