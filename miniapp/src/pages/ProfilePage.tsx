import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box,
  Alert,
  Button,
  Typography,
  Card,
  CardContent
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import MessageIcon from '@mui/icons-material/Message';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { useLikesStore } from '@/store/useLikesStore';
import { apiClient } from '@/api/client';
import { getUserFullName, getUserUsername } from '@/utils/userUtils';

// Компоненты
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { FloatingAvatar } from '@/components/FloatingAvatar';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { StickerSetDetail } from '@/components/StickerSetDetail';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';
import { TelegramThemeToggle } from '@/components/TelegramThemeToggle';
import { SimpleGallery } from '@/components/SimpleGallery';
import { DebugPanel } from '@/components/DebugPanel';
import { BottomNav } from '@/components/BottomNav';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';

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
    setPagination,
    setError,
    setUserError,
    setStickerSetsError,
    getCachedProfile,
    setCachedProfile,
    isCacheValid,
    reset
  } = useProfileStore();
  const { initializeLikes } = useLikesStore();

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStickerSet, setSelectedStickerSet] = useState<any>(null);
  // BottomNav теперь глобальный в MainLayout
  const [activeProfileTab, setActiveProfileTab] = useState(0); // 0: стикерсеты, 1: стикеры, 2: поделиться

  // Валидация userId
  const userIdNumber = userId ? parseInt(userId, 10) : null;
  
  // Проверка, является ли просматриваемый профиль профилем текущего пользователя
  const currentUserId = user?.id;
  const isOwnProfile = currentUserId && userIdNumber === currentUserId;
  
  useEffect(() => {
    if (!userIdNumber || isNaN(userIdNumber)) {
      setError('Некорректный ID пользователя');
      return;
    }

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

    // НЕ вызываем reset() - это очищает кэш!
    loadUserProfile(userIdNumber);
  }, [userIdNumber]);

  // Загрузка профиля пользователя с сервера (кэш проверяется в useEffect)
  const loadUserProfile = async (id: number) => {
    console.log(`🌐 Загрузка профиля ${id} с сервера`);
    setLoading(true);
    
    try {
      // Параллельная загрузка данных пользователя и стикерсетов
      const [userResponse, stickerSetsResponse] = await Promise.allSettled([
        loadUserInfo(id),
        loadUserStickerSets(id)
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
  };

  // Загрузка информации о пользователе
  const loadUserInfo = async (id: number) => {
    setUserLoading(true);
    setUserError(null);

    try {
      const userInfo = await apiClient.getUserInfo(id);
      setUserInfo(userInfo);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки пользователя';
      setUserError(errorMessage);
      throw error;
    } finally {
      setUserLoading(false);
    }
  };

  // Загрузка стикерсетов пользователя
  const loadUserStickerSets = async (id: number, searchQuery?: string) => {
    setStickerSetsLoading(true);
    setStickerSetsError(null);

    try {
      const response = searchQuery 
        ? await apiClient.searchUserStickerSets(id, searchQuery)
        : await apiClient.getUserStickerSets(id);
      
      setUserStickerSets(response.content || []);
      
      // Обновляем пагинацию
      setPagination(
        response.number || 0,
        response.totalPages || 0,
        response.totalElements || 0
      );
      
      // Инициализируем лайки из загруженных данных
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки стикерсетов';
      setStickerSetsError(errorMessage);
      throw error;
    } finally {
      setStickerSetsLoading(false);
    }
  };

  // Обработчики действий
  const handleBack = () => {
    if (viewMode === 'detail') {
      setViewMode('list');
      setSelectedStickerSet(null);
    } else {
      navigate('/'); // Возврат на главную
    }
  };

  const handleViewStickerSet = (id: number, _name: string) => {
    const stickerSet = userStickerSets.find(s => s.id === id);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setViewMode('detail');
    }
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

  const handleShareProfile = () => {
    const userName = userInfo ? getUserFullName(userInfo) : 'Unknown';
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`Профиль пользователя ${userName}`)}`);
    } else {
      navigator.share?.({
        title: `Профиль пользователя ${userName}`,
        url: window.location.href
      }).catch(() => {
        // Fallback для браузеров без поддержки Web Share API
        navigator.clipboard.writeText(window.location.href);
        alert('Ссылка на профиль скопирована в буфер обмена');
      });
    }
  };

  const handleMessageUser = () => {
    const username = userInfo?.telegramUserInfo?.user?.username || userInfo?.username;
    const telegramId = userInfo?.telegramUserInfo?.user?.id || userInfo?.telegramId;
    if (tg) {
      tg.openTelegramLink(`https://t.me/${username || telegramId}`);
    } else {
      window.open(`https://t.me/${username || telegramId}`, '_blank');
    }
  };

  // Обработка поиска
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleSearch = (searchTerm: string) => {
    if (!userIdNumber) return;
    
    if (searchTerm.trim()) {
      loadUserStickerSets(userIdNumber, searchTerm);
    } else {
      loadUserStickerSets(userIdNumber);
    }
  };

  // Фильтрация стикерсетов (локальная + серверная)
  const filteredStickerSets = userStickerSets.filter(stickerSet =>
    stickerSet.title.toLowerCase().includes(searchTerm.toLowerCase())
  );


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

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--tg-theme-bg-color)',
      color: 'var(--tg-theme-text-color)',
      paddingBottom: isInTelegramApp ? 0 : 8,
      overflowX: 'hidden'
    }}>
      {/* Профильный header */}
      <StixlyTopHeader
        profileMode={{
          enabled: true,
          backgroundColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          pattern: 'grid',
          content: null
        }}
      />

      {/* Карточка профиля с аватаром и информацией */}
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, mt: 0 }}>
        {isUserLoading ? (
          <LoadingSpinner message="Загрузка профиля..." />
        ) : userInfo ? (
          <>
            {/* Аватар с overlap */}
            <FloatingAvatar userInfo={userInfo} size="large" overlap={50} />
            
            {/* Username под аватаром */}
            <Box sx={{ 
              textAlign: 'center', 
              mb: 2,
              mt: -2,
              position: 'relative',
              zIndex: 10
            }}>
              {getUserUsername(userInfo) && (
                <Typography 
                  variant="h6" 
                  fontWeight="600"
                  sx={{ 
                    color: 'var(--tg-theme-text-color)',
                    fontSize: '1.125rem'
                  }}
                >
                  @{getUserUsername(userInfo)}
                </Typography>
              )}
            </Box>

            {/* Статистика */}
            <Card sx={{ 
              borderRadius: 3,
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
              border: '1px solid var(--tg-theme-border-color, #e0e0e0)',
              boxShadow: 'none',
              mb: 2
            }}>
              <CardContent sx={{ py: 2, px: 3 }}>
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

                {/* Кнопки действий - показываем только для чужого профиля */}
                {!isOwnProfile && (
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1.5,
                    mt: 2,
                    justifyContent: 'center'
                  }}>
                    <Button
                      variant="outlined"
                      startIcon={<ShareIcon />}
                      onClick={handleShareProfile}
                      sx={{
                        flex: 1,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600
                      }}
                    >
                      Поделиться
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<MessageIcon />}
                      onClick={handleMessageUser}
                      sx={{
                        flex: 1,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600
                      }}
                    >
                      Написать
                    </Button>
                  </Box>
                )}
                
                {/* Уведомление для собственного профиля */}
                {isOwnProfile && (
                  <Box sx={{ 
                    mt: 2,
                    textAlign: 'center'
                  }}>
                    <Typography variant="body2" sx={{ 
                      color: 'var(--tg-theme-hint-color)',
                      fontStyle: 'italic'
                    }}>
                      Это ваш профиль
                    </Typography>
                  </Box>
                )}
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
              {/* Поиск */}
              <SearchBar
                value={searchTerm}
                onChange={handleSearchChange}
                onSearch={handleSearch}
                placeholder="Поиск стикерсетов пользователя..."
                disabled={isStickerSetsLoading}
              />

              {/* Контент стикерсетов */}
              {isStickerSetsLoading ? (
                <LoadingSpinner message="Загрузка стикерсетов..." />
              ) : stickerSetsError ? (
                <ErrorDisplay 
                  error={stickerSetsError} 
                  onRetry={() => userIdNumber && loadUserStickerSets(userIdNumber)} 
                />
              ) : filteredStickerSets.length === 0 ? (
                <EmptyState
                  title="📁 Стикерсетов пока нет"
                  message={
                    searchTerm 
                      ? 'По вашему запросу ничего не найдено' 
                      : userInfo 
                        ? `У пользователя ${getUserFullName(userInfo)} пока нет созданных стикерсетов`
                        : 'У этого пользователя пока нет стикерсетов'
                  }
                  actionLabel="Создать стикер"
                  onAction={handleCreateSticker}
                />
              ) : (
                <div className="fade-in">
                  <SimpleGallery
                    packs={adaptStickerSetsToGalleryPacks(filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                    enablePreloading={true}
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
        ) : (
          // Детальный просмотр стикерсета
          selectedStickerSet && (
            <StickerSetDetail
              stickerSet={selectedStickerSet}
              onBack={() => setViewMode('list')}
              onShare={handleShareStickerSet}
              onLike={handleLikeStickerSet}
              isInTelegramApp={isInTelegramApp}
            />
          )
        )}
      </Container>

      {/* Debug панель */}
      {initData && <DebugPanel initData={initData} />}

      {/* Нижняя навигация */}
      <BottomNav
        activeTab={3} // Профиль
        onChange={(newTab) => {
          if (newTab === 0) navigate('/');
          else if (newTab === 1) navigate('/explore');
          else if (newTab === 2) navigate('/create');
          else if (newTab === 3) navigate('/profile');
        }}
        isInTelegramApp={isInTelegramApp}
      />
    </Box>
  );
};
