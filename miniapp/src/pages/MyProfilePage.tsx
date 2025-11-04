import React, { useEffect, useState, useCallback } from 'react';
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
import { useStickerStore } from '@/store/useStickerStore';
import { apiClient } from '@/api/client';

// Компоненты
import { UserInfoCardModern } from '@/components/UserInfoCardModern';
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { FloatingAvatar } from '@/components/FloatingAvatar';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { BottomNav } from '@/components/BottomNav';
import { StickerSetDetail } from '@/components/StickerSetDetail';
import { StickerPackModal } from '@/components/StickerPackModal';
import { SimpleGallery } from '@/components/SimpleGallery';
import { DebugPanel } from '@/components/DebugPanel';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';
import { isUserPremium, getUserFullName, getUserUsername } from '@/utils/userUtils';
import { UploadStickerPackModal } from '@/components/UploadStickerPackModal';
import { AddStickerPackButton } from '@/components/AddStickerPackButton';
import { SortButton } from '@/components/SortButton';

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
    getCachedProfile,
    setCachedProfile,
    isCacheValid,
    clearCache,
    reset
  } = useProfileStore();
  const { initializeLikes, isLiked } = useLikesStore();
  
  // Подписываемся на изменения лайков для синхронизации списка "понравившиеся"
  const allLikes = useLikesStore((state) => state.likes);

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStickerSet, setSelectedStickerSet] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Фильтр "Сеты": опубликованные (мои) vs понравившиеся
  const [setsFilter, setSetsFilter] = useState<'published' | 'liked'>('published');
  const [likedStickerSets, setLikedStickerSets] = useState<any[]>([]);
  const [activeBottomTab, setActiveBottomTab] = useState(3); // Профиль = индекс 3
  const [activeProfileTab, setActiveProfileTab] = useState(0); // 0: стикерсеты, 1: баланс, 2: поделиться
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [sortByLikes, setSortByLikes] = useState(false);

  // Обработчик кастомизации баннера (placeholder для premium)
  const handleCustomizeBanner = () => {
    // TODO: Реализовать функционал кастомизации баннера в будущем
    console.log('Кастомизация баннера (только для premium пользователей)');
    if (tg) {
      tg.HapticFeedback?.impactOccurred('light');
    }
    // Показываем уведомление или открываем модальное окно в будущем
    alert('Функция кастомизации баннера будет доступна в ближайшее время!');
  };

  // Получаем telegramId текущего пользователя
  const currentUserId = user?.id;

  // Моковые данные для разработки (когда нет валидной initData)
  const mockUserId = 123456789;
  const mockUserInfo = {
    id: mockUserId,
    firstName: 'Иван',
    lastName: 'Иванов',
    username: 'ivan_ivanov',
    artBalance: 150,
    profilePhotoFileId: null,
    profilePhotos: []
  };
  const mockStickerSets: any[] = [
    {
      id: 1,
      title: 'Мои первые стикеры',
      name: 'my_first_stickers',
      stickerCount: 12,
      createdAt: new Date().toISOString(),
      previewSticker: null
    },
    {
      id: 2,
      title: 'Веселые котики',
      name: 'funny_cats',
      stickerCount: 8,
      createdAt: new Date().toISOString(),
      previewSticker: null
    },
    {
      id: 3,
      title: 'Рабочие мемы',
      name: 'work_memes',
      stickerCount: 15,
      createdAt: new Date().toISOString(),
      previewSticker: null
    }
  ];

  useEffect(() => {
    console.log('🔍 MyProfilePage: Текущий пользователь:', user);
    console.log('🔍 MyProfilePage: initData:', initData ? `${initData.length} chars` : 'empty');
    
    // Если нет валидного пользователя, используем моковые данные для разработки
    // НЕ кэшируем моковые данные - они только для разработки
    if (!currentUserId) {
      console.log('🔧 Режим разработки: используем моковые данные');
      setUserInfo(mockUserInfo as any);
      setUserStickerSets(mockStickerSets);
      setPagination(0, 1, mockStickerSets.length);
      return;
    }

    // Проверяем кэш, но игнорируем моковые данные
    if (isCacheValid(currentUserId)) {
      const cached = getCachedProfile(currentUserId);
      // Проверяем, что это НЕ моковые данные (Иван Иванов)
      if (cached && cached.userInfo.firstName !== 'Иван' && cached.userInfo.username !== 'ivan_ivanov') {
        console.log('📦 Профиль уже в кэше, используем его');
        setUserInfo(cached.userInfo);
        setUserStickerSets(cached.stickerSets);
        setPagination(cached.pagination.currentPage, cached.pagination.totalPages, cached.pagination.totalElements);
        
        // ВАЖНО: Инициализируем лайки из кеша (mergeMode = true для сохранения актуальных лайков)
        if (cached.stickerSets.length > 0) {
          initializeLikes(cached.stickerSets, true);
        }
        return;
      } else if (cached && (cached.userInfo.firstName === 'Иван' || cached.userInfo.username === 'ivan_ivanov')) {
        console.log('🗑️ Обнаружены моковые данные в кэше, очищаем и загружаем реальные');
        // Очищаем моковые данные
        reset();
      }
    }

    // Настраиваем заголовки: initData либо заголовки расширения в dev
    if (initData) {
      apiClient.setAuthHeaders(initData);
    } else {
      apiClient.checkExtensionHeaders();
    }

    loadMyProfile(currentUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Загрузка своего профиля с кэшированием
  const loadMyProfile = async (telegramId: number, forceReload: boolean = false) => {
    // Проверяем кэш
    if (!forceReload && isCacheValid(telegramId)) {
      const cached = getCachedProfile(telegramId);
      if (cached) {
        console.log(`📦 Загрузка моего профиля из кэша`);
        setUserInfo(cached.userInfo);
        setUserStickerSets(cached.stickerSets);
        setPagination(cached.pagination.currentPage, cached.pagination.totalPages, cached.pagination.totalElements);
        
        // ВАЖНО: Инициализируем лайки из кеша с mergeMode = true
        // Это сохраняет актуальные лайки из store, но обновляет данные стикерсетов
        if (cached.stickerSets.length > 0) {
          initializeLikes(cached.stickerSets, true);
        }
        return;
      }
    }
    
    // Загружаем с сервера
    console.log(`🌐 Загрузка моего профиля с сервера`);
    setLoading(true);
    
    try {
      console.log('🔍 Загрузка профиля пользователя с Telegram ID:', telegramId);
      
      // Параллельная загрузка данных пользователя и стикерсетов
      const [userResponse, stickerSetsResponse] = await Promise.allSettled([
        loadUserInfo(telegramId),
        loadUserStickerSets(telegramId, undefined, 0, false, sortByLikes)
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
        const currentUserInfo = useProfileStore.getState().userInfo;
        const currentStickerSets = useProfileStore.getState().userStickerSets;
        const currentPagination = {
          currentPage: useProfileStore.getState().currentPage,
          totalPages: useProfileStore.getState().totalPages,
          totalElements: useProfileStore.getState().totalElements
        };
        
        if (currentUserInfo && currentStickerSets) {
          setCachedProfile(telegramId, currentUserInfo, currentStickerSets, currentPagination);
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
      // В режиме разработки используем моковые данные вместо показа ошибки
      if (error?.response?.status === 401 || !isInTelegramApp) {
        console.log('🔧 Режим разработки: используем моковые данные профиля');
        setUserInfo(mockUserInfo as any);
        setUserError(null);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки пользователя';
        setUserError(errorMessage);
      }
      // Не пробрасываем ошибку дальше в режиме разработки
      if (isInTelegramApp) {
        throw error;
      }
    } finally {
      setUserLoading(false);
    }
  };

  // Загрузка стикерсетов пользователя
  const loadUserStickerSets = async (telegramId: number, searchQuery?: string, page: number = 0, append: boolean = false, sortByLikesParam?: boolean) => {
    setStickerSetsLoading(true);
    setStickerSetsError(null);

    try {
      // Используем userInfo.id если он уже загружен, иначе telegramId
      const userId = userInfo?.id || telegramId;
      
      console.log('🔍 Загрузка стикерсетов для userId:', userId, 'telegramId:', telegramId, 'searchQuery:', searchQuery, 'sortByLikes:', sortByLikesParam);
      
      // Если есть поисковый запрос, используем специальный эндпоинт поиска
      if (searchQuery && searchQuery.trim()) {
        const response = await apiClient.searchUserStickerSets(userId, searchQuery, page, 20);
        
        if (append) {
          setUserStickerSets(response.number === 0 ? (response.content || []) : getUniqueAppended(userStickerSets, response.content || []));
        } else {
          setUserStickerSets(response.content || []);
        }
        
        if (response.content && response.content.length > 0) {
          initializeLikes(response.content);
        }
        
        setPagination(response.number, response.totalPages, response.totalElements);
        return;
      }
      
      // Загружаем стикерсеты пользователя
      // При выключенной сортировке по лайкам: сортировка по createdAt DESC (последние добавленные)
      // При включенной: загружаем как есть, затем сортируем локально по лайкам
      // Используем 'createdAt' так как API поддерживает только 'createdAt' | 'title' | 'name'
      const response = await apiClient.getUserStickerSets(userId, page, 20, 'createdAt', 'DESC');
      
      console.log('✅ Стикерсеты загружены:', response.content?.length || 0, 'страница:', response.number, 'из', response.totalPages);
      
      // Инициализируем лайки из загруженных данных
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content);
      }
      
      // Если включена сортировка по лайкам, сортируем локально по likesCount DESC
      let finalContent = response.content || [];
      if (sortByLikesParam && finalContent.length > 0) {
        finalContent = [...finalContent].sort((a, b) => {
          const likesA = a.likes || a.likesCount || 0;
          const likesB = b.likes || b.likesCount || 0;
          return likesB - likesA; // DESC - от самых лайкнутых
        });
      }
      
      if (append) {
        setUserStickerSets(response.number === 0 ? finalContent : getUniqueAppended(userStickerSets, finalContent));
      } else {
        setUserStickerSets(finalContent);
      }
      
      // Обновляем пагинацию
      setPagination(response.number, response.totalPages, response.totalElements);
    } catch (error: any) {
      // В режиме разработки используем моковые данные вместо показа ошибки
      if (error?.response?.status === 401 || !isInTelegramApp) {
        console.log('🔧 Режим разработки: используем моковые данные стикерсетов');
        const filtered = searchQuery 
          ? mockStickerSets.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
          : mockStickerSets;
        setUserStickerSets(filtered);
        setPagination(0, 1, filtered.length);
        setStickerSetsError(null);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки стикерсетов';
        console.error('❌ Ошибка загрузки стикерсетов:', error);
        setStickerSetsError(errorMessage);
      }
      // Не пробрасываем ошибку дальше в режиме разработки
      if (isInTelegramApp) {
        throw error;
      }
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

  const handleViewStickerSet = (packId: string) => {
    const source = setsFilter === 'liked' ? likedStickerSets : userStickerSets;
    const stickerSet = source.find(s => s.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStickerSet(null);
    
    // Всегда обновляем список "понравившиеся" если активен этот фильтр
    // (модальное окно могло обновить состояние лайка через store)
    if (setsFilter === 'liked') {
      // Используем функцию синхронизации для обновления списка
      syncLikedListFromStore();
    }
    
    // ВАЖНО: Инвалидируем кеш профиля при изменении лайков
    // Кеш содержит устаревшие данные о лайках, нужно обновить
    if (currentUserId) {
      clearCache(currentUserId);
      console.log('🔄 Кеш профиля инвалидирован после изменения лайков');
    }
  };
  
  // Получаем стикерсеты из галереи для использования в списке понравившихся
  const galleryStickerSets = useStickerStore((state) => state.stickerSets);
  
  // Простая функция синхронизации списка понравившихся из store
  // ВАЖНО: НЕ используем likedStickerSets внутри чтобы избежать цикла
  const syncLikedListFromStore = useCallback(() => {
    const { isLiked: isLikedFn } = useLikesStore.getState();
    
    // Объединяем все доступные источники данных
    const allAvailableSets = [...userStickerSets, ...galleryStickerSets];
    
    // Фильтруем по лайкам из store (единственный источник правды)
    const liked = allAvailableSets.filter(s => isLikedFn(String(s.id)));
    
    // Убираем дубликаты по ID
    const unique = Array.from(new Map(liked.map(s => [String(s.id), s])).values());
    
    // Обновляем список (без проверки на изменение чтобы избежать проблем с зависимостями)
    setLikedStickerSets(unique);
  }, [userStickerSets, galleryStickerSets]);

  const handleShareStickerSet = (name: string, _title: string) => {
    if (tg) {
      tg.openTelegramLink(`https://t.me/addstickers/${name}`);
    } else {
      window.open(`https://t.me/addstickers/${name}`, '_blank');
    }
  };

  // Простая загрузка понравившихся: формируем список из store
  const loadLikedStickerSets = useCallback(async () => {
    try {
      setStickerSetsLoading(true);
      
      // Пытаемся загрузить с сервера для получения полных данных
      try {
        const response = await apiClient.getStickerSets(0, 50, { likedOnly: true });
        const serverLikedSets = response.content || [];
        
        // Инициализируем лайки из серверных данных (mergeMode = true сохраняет локальные)
        if (serverLikedSets.length > 0) {
          initializeLikes(serverLikedSets, true);
        }
      } catch (e) {
        // Игнорируем ошибку загрузки с сервера - используем локальные данные
        console.warn('⚠️ Не удалось загрузить понравившиеся с сервера, используем локальные данные');
      }
      
      // Формируем список из store - это единственный источник правды
      // initializeLikes синхронный, поэтому можно вызывать сразу
      syncLikedListFromStore();
    } finally {
      setStickerSetsLoading(false);
    }
  }, [syncLikedListFromStore, initializeLikes]);
  
  // Единый useEffect для синхронизации списка "понравившиеся"
  useEffect(() => {
    if (setsFilter === 'liked') {
      // Проверяем есть ли данные для синхронизации
      const hasData = userStickerSets.length > 0 || galleryStickerSets.length > 0;
      
      if (!hasData) {
        // Загружаем с сервера если нет локальных данных
        loadLikedStickerSets();
      } else {
        // Синхронизируем с текущим состоянием store
        syncLikedListFromStore();
      }
    }
  }, [setsFilter, allLikes, userStickerSets, galleryStickerSets, syncLikedListFromStore, loadLikedStickerSets]);

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
  };

  // Обработка поиска с отправкой
  const handleSearch = (searchTermValue: string) => {
    const userId = currentUserId || mockUserId;
    if (!userId) return;
    
    if (searchTermValue.trim()) {
      loadUserStickerSets(userId, searchTermValue, 0, false, sortByLikes);
    } else {
      loadUserStickerSets(userId, undefined, 0, false, sortByLikes);
    }
  };

  // Обработка переключения сортировки
  const handleSortToggle = () => {
    const newSortByLikes = !sortByLikes;
    setSortByLikes(newSortByLikes);
    const userId = currentUserId || mockUserId;
    if (userId) {
      loadUserStickerSets(userId, searchTerm || undefined, 0, false, newSortByLikes);
    }
  };

  // Фильтрация стикерсетов (при поиске данные уже отфильтрованы на сервере)
  const filteredStickerSets = userStickerSets;

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

  // Основные ошибки (показываем только в Telegram приложении)
  if (error && isInTelegramApp) {
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

  // Проверка premium статуса
  const isPremium = userInfo ? isUserPremium(userInfo) : false;

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
      color: 'var(--tg-theme-text-color, #000000)',
      paddingBottom: isInTelegramApp ? 0 : 8,
      overflowX: 'hidden'
    }}>
      {/* Профильный header */}
      <StixlyTopHeader
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
              {/* Аватар с overlap - наполовину на header */}
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

      {/* Карточка с достижениями под аватаром */}
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, mt: 0 }}>
        {userInfo && (
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
                
                <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold"
                    sx={{ 
                      color: 'var(--tg-theme-button-color)',
                      // Золотой оттенок для ART в светлой теме
                      filter: 'brightness(1.1) saturate(1.2)'
                    }}
                  >
                    {userInfo.artBalance || 0}
                  </Typography>
                  <Typography 
                    variant="body2"
                    sx={{ color: 'var(--tg-theme-hint-color)' }}
                  >
                    ART
                  </Typography>
                </Box>
              </Box>
              
              {/* Кнопка поделиться профилем */}
              {/* Кнопка "Поделиться профилем" удалена по требованиям дизайна */}
            </CardContent>
          </Card>
        )}

        {/* Ошибка пользователя */}
        {userError && isInTelegramApp && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 2,
              mb: 2,
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
              color: 'var(--tg-theme-text-color, #000000)',
              border: '1px solid var(--tg-theme-border-color, #e0e0e0)'
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
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, pb: 2 }}>
        {viewMode === 'list' ? (
          <>
            {/* Контент вкладок - прокручиваемый */}
            <TabPanel value={activeProfileTab} index={0}>
              {/* Переключатель Published/Liked */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Chip
                  label="Сеты"
                  color={setsFilter === 'published' ? 'primary' : 'default'}
                  variant={setsFilter === 'published' ? 'filled' : 'outlined'}
                  onClick={() => setSetsFilter('published')}
                  sx={{ borderRadius: 2 }}
                />
                <Chip
                  label="Понравившиеся"
                  color={setsFilter === 'liked' ? 'primary' : 'default'}
                  variant={setsFilter === 'liked' ? 'filled' : 'outlined'}
                  onClick={() => {
                    setSetsFilter('liked');
                    // Список обновится в useEffect при изменении setsFilter
                  }}
                  sx={{ borderRadius: 2 }}
                />
              </Box>

              {/* Поиск и сортировка */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.618rem', mb: '0.618rem', px: '0.618rem' }}>
                <Box sx={{ flex: 1 }}>
                  <SearchBar
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onSearch={handleSearch}
                    placeholder="Поиск моих стикерсетов..."
                    disabled={isStickerSetsLoading}
                  />
                </Box>
                <SortButton
                  sortByLikes={sortByLikes}
                  onToggle={handleSortToggle}
                  disabled={isStickerSetsLoading || !!searchTerm}
                />
              </Box>

              {/* Контент стикерсетов */}
              {isStickerSetsLoading ? (
                <LoadingSpinner message="Загрузка стикерсетов..." />
              ) : stickerSetsError && isInTelegramApp ? (
                <ErrorDisplay 
                  error={stickerSetsError} 
                  onRetry={() => (currentUserId || mockUserId) && loadUserStickerSets(currentUserId || mockUserId, searchTerm || undefined, 0, false, sortByLikes)} 
                />
              ) : (setsFilter === 'liked' ? likedStickerSets.length === 0 : filteredStickerSets.length === 0) ? (
                <EmptyState
                  title={setsFilter === 'liked' ? '❤️ Понравившихся пока нет' : '📁 У вас пока нет стикерсетов'}
                  message={
                    setsFilter === 'liked' 
                      ? 'Лайкните понравившиеся наборы в галерее, и они появятся здесь'
                      : (searchTerm 
                          ? 'По вашему запросу ничего не найдено' 
                          : 'Создайте свой первый набор стикеров!')
                  }
                  actionLabel="Создать стикер"
                  onAction={handleCreateSticker}
                />
                              ) : (
                  <SimpleGallery
                    packs={adaptStickerSetsToGalleryPacks(setsFilter === 'liked' ? likedStickerSets : filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                    hasNextPage={setsFilter === 'liked' ? false : currentPage < totalPages - 1}
                    isLoadingMore={isStickerSetsLoading}
                    onLoadMore={setsFilter === 'liked' ? undefined : () => (currentUserId || mockUserId) && loadUserStickerSets(currentUserId || mockUserId, searchTerm || undefined, currentPage + 1, true, sortByLikes)}
                    enablePreloading={true}
                    addButtonElement={setsFilter === 'published' ? (
                      <AddStickerPackButton
                        variant="gallery"
                        onClick={() => setIsUploadModalOpen(true)}
                      />
                    ) : undefined}
                  />
                )}

              {/* Кнопка "Показать ещё" убрана, так как SimpleGallery использует infinite scroll */}
              {false && filteredStickerSets.length > 0 && (currentPage < totalPages - 1) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => (currentUserId || mockUserId) && loadUserStickerSets(currentUserId || mockUserId, undefined, currentPage + 1, true)}
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
                      sx={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 'bold',
                        height: 56,
                        px: 3,
                        backgroundColor: 'var(--tg-theme-button-color)',
                        color: 'var(--tg-theme-button-text-color)'
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

              {/* Кнопка создания стикерпака */}
              <AddStickerPackButton
                variant="profile"
                onClick={() => setIsUploadModalOpen(true)}
              />
            </TabPanel>

            <TabPanel value={activeProfileTab} index={2}>
              {/* Достижения профиля */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                alignItems: 'center',
                justifyContent: 'center',
                py: 5,
                minHeight: '220px'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                  Достижения
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    Сеты: {userStickerSets.length}
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    Стикеры: {userStickerSets.reduce((s, set) => s + (set.stickerCount || 0), 0)}
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    ART: {userInfo?.artBalance || 0}
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center' }}>
                  Скоро появятся уровни, streak и редкие ачивки.
                </Typography>
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
        onLike={(id) => {
          // Настоящее переключение лайка через store
          useLikesStore.getState().toggleLike(String(id));
        }}
      />

      {/* Debug панель */}
      {initData && <DebugPanel initData={initData} />}

      {/* Модальное окно загрузки стикерпака */}
      <UploadStickerPackModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={async (link: string) => {
          await apiClient.uploadStickerPackByLink(link);
          // Обновляем профиль и список стикерсетов после успешной загрузки
          if (currentUserId) {
            await loadMyProfile(currentUserId, true);
          }
        }}
      />
    </Box>
  );
};

