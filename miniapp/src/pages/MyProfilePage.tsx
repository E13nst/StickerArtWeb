import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box,
  Alert,
  Button,
  Typography,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import AddIcon from '@mui/icons-material/Add';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { useLikesStore } from '@/store/useLikesStore';
import { apiClient } from '@/api/client';

// Компоненты
import { UserInfoCard } from '@/components/UserInfoCard';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { BottomNav } from '@/components/BottomNav';
import { StickerSetDetail } from '@/components/StickerSetDetail';
import { StickerPackModal } from '@/components/StickerPackModal';
import { GalleryGrid } from '@/components/GalleryGrid';
import { DebugPanel } from '@/components/DebugPanel';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';

export const MyProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { tg, user, initData, isInTelegramApp } = useTelegram();

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
    reset
  } = useProfileStore();
  const { initializeLikes } = useLikesStore();

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStickerSet, setSelectedStickerSet] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState(3); // Профиль = индекс 3
  const [activeProfileTab, setActiveProfileTab] = useState(0); // 0: стикерсеты, 1: баланс, 2: поделиться

  // Получаем telegramId текущего пользователя
  const currentUserId = user?.id;

  useEffect(() => {
    console.log('🔍 MyProfilePage: Текущий пользователь:', user);
    console.log('🔍 MyProfilePage: initData:', initData ? `${initData.length} chars` : 'empty');
    
    if (!currentUserId) {
      setError('Не удалось получить информацию о пользователе из Telegram');
      return;
    }

    // Сбрасываем состояние и загружаем профиль
    reset();

    // Настраиваем заголовки: initData либо заголовки расширения в dev
    if (initData) {
      apiClient.setAuthHeaders(initData);
    } else {
      apiClient.checkExtensionHeaders();
    }

    loadMyProfile(currentUserId);
  }, [currentUserId]);

  // Загрузка своего профиля
  const loadMyProfile = async (telegramId: number) => {
    setLoading(true);
    
    try {
      console.log('🔍 Загрузка профиля пользователя с Telegram ID:', telegramId);
      
      // Параллельная загрузка данных пользователя и стикерсетов
      const [userResponse, stickerSetsResponse] = await Promise.allSettled([
        loadUserInfo(telegramId),
        loadUserStickerSets(telegramId)
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

  // Загрузка информации о текущем пользователе (+ профиль + фото)
  const loadUserInfo = async (telegramId: number) => {
    setUserLoading(true);
    setUserError(null);

    try {
      // 1) получаем полный профиль через новый API /profiles/{userId}
      const userProfile = await apiClient.getProfile(telegramId);

      // 2) фото профиля /users/{id}/photo (404 -> null)
      const photo = await apiClient.getUserPhoto(userProfile.id);

      const combined = {
        ...userProfile,
        profilePhotoFileId: photo?.profilePhotoFileId,
        profilePhotos: photo?.profilePhotos
      };

      console.log('✅ Информация о пользователе загружена:', combined);
      setUserInfo(combined as any);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        setUserError('Требуется авторизация');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки пользователя';
        setUserError(errorMessage);
      }
      throw error;
    } finally {
      setUserLoading(false);
    }
  };

  // Загрузка стикерсетов пользователя
  const loadUserStickerSets = async (telegramId: number, searchQuery?: string, page: number = 0, append: boolean = false) => {
    setStickerSetsLoading(true);
    setStickerSetsError(null);

    try {
      // Используем userInfo.id если он уже загружен, иначе telegramId
      const userId = userInfo?.id || telegramId;
      
      console.log('🔍 Загрузка стикерсетов для userId:', userId, 'telegramId:', telegramId, 'searchQuery:', searchQuery);
      
      // По ТЗ сортировка createdAt DESC
      const response = await apiClient.getUserStickerSets(userId, page, 20, 'createdAt', 'DESC');
      
      console.log('✅ Стикерсеты загружены:', response.content?.length || 0, 'страница:', response.number, 'из', response.totalPages);
      if (append) {
        setUserStickerSets(response.number === 0 ? (response.content || []) : getUniqueAppended(userStickerSets, response.content || []));
      } else {
        setUserStickerSets(response.content || []);
      }
      
      // Инициализируем лайки из загруженных данных
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content);
      }
      
      // Обновляем пагинацию
      setPagination(response.number, response.totalPages, response.totalElements);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        setStickerSetsError('Требуется авторизация');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки стикерсетов';
        console.error('❌ Ошибка загрузки стикерсетов:', error);
        setStickerSetsError(errorMessage);
      }
      throw error;
    } finally {
      setStickerSetsLoading(false);
    }
  };

  // Утилита для уникального добавления (без дубликатов)
  const getUniqueAppended = (existing: any[], incoming: any[]) => {
    const ids = new Set(existing.map((s) => s.id));
    const unique = incoming.filter((s) => !ids.has(s.id));
    return [...existing, ...unique];
  };

  // Обработчики действий
  const handleBack = () => {
    if (isModalOpen) {
      handleCloseModal();
      return;
    }
    navigate('/'); // Возврат на главную
  };

  const handleViewStickerSet = (id: number, _name: string) => {
    const stickerSet = userStickerSets.find(s => s.id === id);
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

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/profile/${userInfo?.id}`;
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(`Мой профиль в Sticker Gallery`)}`);
    } else {
      navigator.share?.({
        title: 'Мой профиль в Sticker Gallery',
        url: profileUrl
      }).catch(() => {
        // Fallback для браузеров без поддержки Web Share API
        navigator.clipboard.writeText(profileUrl);
        alert('Ссылка на профиль скопирована в буфер обмена');
      });
    }
  };

  // Обработка поиска
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    
    if (!currentUserId) return;

    // Дебаунс поиска
    const delayedSearch = setTimeout(() => {
      loadUserStickerSets(currentUserId, newSearchTerm);
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

  console.log('🔍 MyProfilePage состояние:', {
    currentUserId,
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
            message="Не удалось загрузить ваш профиль"
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
      paddingBottom: isInTelegramApp ? 0 : 8 // Отступ для BottomNav
    }}>

      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ py: 1.5 }}> {/* уменьшено для экономии пространства */}
        {viewMode === 'list' ? (
          <>
            {/* Информация о пользователе */}
            {userInfo && (
              <UserInfoCard 
                userInfo={userInfo} 
                isLoading={isUserLoading}
                onShareProfile={handleShareProfile}
              />
            )}

            {/* Ошибка пользователя */}
            {userError && (
              <Alert severity="error" sx={{ 
                mb: 2,
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-text-color)',
                border: '1px solid var(--tg-theme-border-color)'
              }}>
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
                placeholder="Поиск моих стикерсетов..."
                disabled={isStickerSetsLoading}
              />

              {/* Контент стикерсетов */}
              {isStickerSetsLoading ? (
                <LoadingSpinner message="Загрузка стикерсетов..." />
              ) : stickerSetsError ? (
                <ErrorDisplay 
                  error={stickerSetsError} 
                  onRetry={() => currentUserId && loadUserStickerSets(currentUserId)} 
                />
              ) : filteredStickerSets.length === 0 ? (
                <EmptyState
                  title="📁 У вас пока нет стикерсетов"
                  message={
                    searchTerm 
                      ? 'По вашему запросу ничего не найдено' 
                      : 'Создайте свой первый набор стикеров!'
                  }
                  actionLabel="Создать стикер"
                  onAction={handleCreateSticker}
                />
              ) : (
                <div className="fade-in">
                  <GalleryGrid
                    packs={adaptStickerSetsToGalleryPacks(filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                  />
                </div>
              )}

              {/* Показать ещё */}
              {filteredStickerSets.length > 0 && (currentPage < totalPages - 1) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => currentUserId && loadUserStickerSets(currentUserId, undefined, currentPage + 1, true)}
                  >
                    Показать ещё
                  </Button>
                </Box>
              )}
            </TabPanel>

            <TabPanel value={activeProfileTab} index={1}>
              {/* Баланс ART */}
              <Card sx={{ 
                mb: 2, 
                borderRadius: 3,
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-text-color)',
                border: '1px solid var(--tg-theme-border-color)',
                boxShadow: '0 2px 8px var(--tg-theme-shadow-color)'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <AccountBalanceWalletIcon sx={{ fontSize: 40, color: 'var(--tg-theme-button-color)' }} />
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        Баланс ART
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
                        Ваши стикер-токены
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                    <Chip 
                      label={`${userInfo?.artBalance || 0} ART`}
                      color="primary"
                      sx={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 'bold',
                        height: 56,
                        px: 3
                      }}
                    />
                  </Box>

                  <Typography variant="body2" sx={{ 
                    color: 'var(--tg-theme-hint-color)', 
                    textAlign: 'center', 
                    mt: 2 
                  }}>
                    Создавайте стикеры и зарабатывайте ART токены!
                  </Typography>
                </CardContent>
              </Card>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateSticker}
                fullWidth
                size="large"
              >
                Создать новый стикерсет
              </Button>
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
                <Typography variant="h6" sx={{ 
                  color: 'var(--tg-theme-hint-color)', 
                  textAlign: 'center' 
                }}>
                  Поделиться профилем
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                  <Button
                    variant="contained"
                    startIcon={<ShareIcon />}
                    onClick={handleShareProfile}
                    size="large"
                    fullWidth
                    sx={{ maxWidth: 300 }}
                  >
                    Поделиться профилем
                  </Button>
                </Box>
              </Box>
            </TabPanel>
          </>
        ) : null}
      </Container>

      {/* Нижняя навигация */}
      <BottomNav
        activeTab={activeBottomTab}
        onChange={setActiveBottomTab}
        isInTelegramApp={isInTelegramApp}
      />

      {/* Модалка деталей стикерсета */}
      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
        onLike={(id, title) => {
          console.log(`Лайк для стикерсета ${id}: ${title}`);
        }}
      />

      {/* Debug панель */}
      {initData && <DebugPanel initData={initData} />}
    </Box>
  );
};

