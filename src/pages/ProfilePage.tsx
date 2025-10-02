import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box,
  Alert,
  Button,
  Typography
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import MessageIcon from '@mui/icons-material/Message';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { apiClient } from '@/api/client';

// Компоненты
import { Header } from '@/components/Header';
import { UserInfoCard } from '@/components/UserInfoCard';
import { SearchBar } from '@/components/SearchBar';
import { StickerSetList } from '@/components/StickerSetList';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { BottomNav } from '@/components/BottomNav';
import { StickerSetDetail } from '@/components/StickerSetDetail';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { tg, isInTelegramApp } = useTelegram();

  const {
    isLoading,
    isUserLoading,
    isStickerSetsLoading,
    userInfo,
    userStickerSets,
    error,
    userError,
    stickerSetsError,
    setLoading,
    setUserLoading,
    setStickerSetsLoading,
    setUserInfo,
    setUserStickerSets,
    setError,
    setUserError,
    setStickerSetsError,
    reset
  } = useProfileStore();

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStickerSet, setSelectedStickerSet] = useState<any>(null);
  const [activeBottomTab, setActiveBottomTab] = useState(3); // Профиль = индекс 3
  const [activeProfileTab, setActiveProfileTab] = useState(0); // 0: стикерсеты, 1: стикеры, 2: поделиться

  // Валидация userId
  const userIdNumber = userId ? parseInt(userId, 10) : null;
  
  useEffect(() => {
    if (!userIdNumber || isNaN(userIdNumber)) {
      setError('Некорректный ID пользователя');
      return;
    }

    // Сбрасываем состояние при смене пользователя
    reset();
    loadUserProfile(userIdNumber);
  }, [userIdNumber]);

  // Загрузка профиля пользователя
  const loadUserProfile = async (id: number) => {
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
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`Профиль пользователя ${userInfo?.firstName || 'Unknown'}`)}`);
    } else {
      navigator.share?.({
        title: `Профиль пользователя ${userInfo?.firstName || 'Unknown'}`,
        url: window.location.href
      }).catch(() => {
        // Fallback для браузеров без поддержки Web Share API
        navigator.clipboard.writeText(window.location.href);
        alert('Ссылка на профиль скопирована в буфер обмена');
      });
    }
  };

  const handleMessageUser = () => {
    if (tg) {
      tg.openTelegramLink(`https://t.me/${userInfo?.username || userInfo?.telegramId}`);
    } else {
      window.open(`https://t.me/${userInfo?.username || userInfo?.telegramId}`, '_blank');
    }
  };

  // Обработка поиска
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    
    if (!userIdNumber) return;

    // Дебаунс поиска
    const delayedSearch = setTimeout(() => {
      loadUserStickerSets(userIdNumber, newSearchTerm);
    }, 500);

    return () => clearTimeout(delayedSearch);
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
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        <Header 
          title="Профиль пользователя"
          onMenuClick={handleBack}
          showOptions={false}
        />
        <Container maxWidth="lg" sx={{ py: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
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
      backgroundColor: 'background.default',
      paddingBottom: isInTelegramApp ? 0 : 8 // Отступ для BottomNav
    }}>
      {/* Заголовок */}
      <Header 
        title={viewMode === 'detail' ? selectedStickerSet?.title || 'Детали' : 'Профиль пользователя'}
        onMenuClick={handleBack}
        showOptions={false}
      />

      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ py: 2 }}>
        {viewMode === 'list' ? (
          <>
            {/* Информация о пользователе */}
            {userInfo && (
              <UserInfoCard 
                userInfo={userInfo} 
                isLoading={isUserLoading}
                onShareProfile={handleShareProfile}
                onMessageUser={handleMessageUser}
              />
            )}

            {/* Ошибка пользователя */}
            {userError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {userError}
              </Alert>
            )}

            {/* Вкладки профиля */}
            <ProfileTabs
              activeTab={activeProfileTab}
              onChange={setActiveProfileTab}
              isInTelegramApp={isInTelegramApp}
            />

            {/* Контент вкладок */}
            <TabPanel value={activeProfileTab} index={0}>
              {/* Поиск */}
              <SearchBar
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="🔍 Поиск стикерсетов пользователя..."
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
                        ? `У пользователя ${userInfo.firstName} пока нет созданных стикерсетов`
                        : 'У этого пользователя пока нет стикерсетов'
                  }
                  actionLabel="Создать стикер"
                  onAction={handleCreateSticker}
                />
              ) : (
                <StickerSetList
                  stickerSets={filteredStickerSets}
                  onView={handleViewStickerSet}
                  isInTelegramApp={isInTelegramApp}
                />
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
              {/* Действия с профилем */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                alignItems: 'center',
                py: 4
              }}>
                <Typography variant="h6" color="text.secondary" textAlign="center">
                  Поделиться профилем
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    startIcon={<ShareIcon />}
                    onClick={handleShareProfile}
                    size="large"
                    sx={{ minWidth: 200 }}
                  >
                    Поделиться профилем
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<MessageIcon />}
                    onClick={handleMessageUser}
                    size="large"
                    sx={{ minWidth: 200 }}
                  >
                    Написать пользователю
                  </Button>
                </Box>
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

      {/* Нижняя навигация */}
      <BottomNav
        activeTab={activeBottomTab}
        onChange={setActiveBottomTab}
        isInTelegramApp={isInTelegramApp}
      />
    </Box>
  );
};
