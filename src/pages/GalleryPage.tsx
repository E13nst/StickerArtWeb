import React, { useEffect, useState, useRef } from 'react';
import { Container, Box } from '@mui/material';
import { useTelegram } from '@/hooks/useTelegram';
import { useStickerStore } from '@/store/useStickerStore';
import { apiClient } from '@/api/client';

// Компоненты
import { Header } from '@/components/Header';
import MinimalSearchBar from '@/components/MinimalSearchBar';
import { CategoriesFilter } from '@/components/CategoriesFilter';
import { StickerSetList } from '@/components/StickerSetList';
import { StickerSetDetail } from '@/components/StickerSetDetail';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { BottomNav } from '@/components/BottomNav';

// Хуки
import { useCategories } from '@/hooks/useCategories';
import { useScrollHue } from '@/hooks/useScrollHue';
import { useTgSafeArea } from '@/telegram/useTgSafeArea';

// Функция для перемешивания массива в случайном порядке
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const GalleryPage: React.FC = () => {
  // Хук для градиентного фона с изменением оттенка при скролле
  useScrollHue(190, 255);
  
  // Хук для обработки безопасных зон Telegram
  useTgSafeArea();

  const { tg, user, initData, isReady, isInTelegramApp, checkInitDataExpiry } = useTelegram();
  const {
    isLoading,
    isAuthLoading,
    stickerSets,
    authStatus: _authStatus,
    error,
    authError,
    searchTerm,
    selectedCategories,
    viewMode,
    selectedStickerSet,
    setAuthStatus,
    setStickerSets,
    setLoading,
    setAuthLoading,
    setError,
    setAuthError,
    setSearchTerm,
    setSelectedCategories,
    setViewMode,
    setSelectedStickerSet
  } = useStickerStore();

  const { categories, loading: categoriesLoading } = useCategories();

  // Состояние для управления отображением поиска при скролле
  const [showSearch, setShowSearch] = useState(true);
  const lastScrollY = useRef(0);
  
  // Состояние для активной вкладки нижней навигации
  const [activeBottomTab, setActiveBottomTab] = useState(0);

  // Авторизация пользователя
  const authenticateUser = async (currentInitData: string) => {
    if (!currentInitData || currentInitData === 'undefined') {
      logger.warn('⚠️ InitData отсутствует, пропускаем авторизацию');
      setAuthStatus({
        authenticated: false,
        message: 'InitData отсутствует'
      });
      return false;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      // Проверяем срок действия initData (пропускаем для тестовых данных)
      const isTestData = currentInitData.includes('query_id=test');
      if (!isTestData) {
        const initDataCheck = checkInitDataExpiry(currentInitData);
        console.log('Checking initData:', initDataCheck);
        if (!initDataCheck.valid) {
          throw new Error(initDataCheck.reason);
        }
      } else {
        console.log('Test data - skipping expiry check');
      }

      // Устанавливаем заголовки аутентификации
      apiClient.setAuthHeaders(currentInitData);

      // Проверяем статус авторизации
      console.log('Checking auth status...');
      const authResponse = await apiClient.checkAuthStatus();
      console.log('Auth response:', authResponse);
      setAuthStatus(authResponse);

      if (!authResponse.authenticated) {
        throw new Error(authResponse.message || 'Ошибка авторизации');
      }

    } catch (error) {
      console.error('❌ Ошибка авторизации:', error);
      let errorMessage = 'Произошла ошибка при авторизации.';
      
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          errorMessage = 'Сервер недоступен. Проверьте подключение к интернету.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Превышено время ожидания при авторизации.';
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Ошибка сети при авторизации.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setAuthError(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  // Загрузка стикерсетов
  const fetchStickerSets = async (page: number = 0) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Loading sticker sets...');
      const response = await apiClient.getStickerSetsWithCategories(
        page,
        20,
        (selectedCategories || []).length > 0 ? selectedCategories : undefined
      );
      
      console.log('Received sticker sets:', response);
      
      // Перемешиваем стикерсеты в случайном порядке
      const shuffledContent = shuffleArray(response.content || []);
      setStickerSets(shuffledContent);

    } catch (error) {
      console.error('❌ Ошибка загрузки стикеров:', error);
      let errorMessage = 'Произошла ошибка при загрузке стикеров.';
      
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          errorMessage = 'Сервер недоступен. Проверьте подключение к интернету и попробуйте позже.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Превышено время ожидания. Сервер отвечает слишком долго.';
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Поиск стикерсетов
  const searchStickerSets = async (query: string) => {
    if (!query.trim()) {
      fetchStickerSets();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Searching stickers:', query);
      const response = await apiClient.searchStickerSets(query);
      console.log('Search results:', response);
      
      // Перемешиваем результаты поиска в случайном порядке
      const shuffledContent = shuffleArray(response.content || []);
      setStickerSets(shuffledContent);

    } catch (error) {
      console.error('❌ Ошибка поиска стикеров:', error);
      let errorMessage = 'Произошла ошибка при поиске стикеров.';
      
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          errorMessage = 'Сервер недоступен. Поиск временно недоступен.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Превышено время ожидания при поиске.';
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Ошибка сети при поиске.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Обработчики событий
  const handleCategoriesChange = (newCategories: string[]) => {
    setSelectedCategories(newCategories);
  };

  const handleViewStickerSet = (id: number, _name: string) => {
    const stickerSet = stickerSets.find(s => s.id === id);
    if (stickerSet) {
      // Переходим в детальный просмотр стикерсета
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
    console.log(`Like sticker set: ${title} (ID: ${id})`);
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const handleCreateSticker = () => {
    if (tg) {
      tg.openTelegramLink('https://t.me/StickerGalleryBot');
    } else {
      window.open('https://t.me/StickerGalleryBot', '_blank');
    }
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const handleOptionsClick = () => {
    console.log('Options clicked');
  };

  const handleBottomNavChange = (newValue: number) => {
    setActiveBottomTab(newValue);
  };

  // Обработчик поиска с задержкой
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);

    const delayedSearch = setTimeout(() => {
      searchStickerSets(newSearchTerm);
    }, 500);

    return () => clearTimeout(delayedSearch);
  };

  // Фильтрация стикерсетов
  const filteredStickerSets = stickerSets.filter(stickerSet =>
    stickerSet.title.toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  // Логирование состояния для отладки
  useEffect(() => {
  console.log('GalleryPage state:', {
    stickerSets: stickerSets.length,
    filteredStickerSets: filteredStickerSets.length,
    searchTerm: searchTerm || '',
    viewMode: viewMode || 'list',
    isInTelegramApp,
    categories: categories.length,
    isLoading,
    isAuthLoading,
    error,
    authError,
    selectedStickerSet: selectedStickerSet?.id,
    selectedStickerSetTitle: selectedStickerSet?.title
  });
  });

  // Инициализация приложения
  useEffect(() => {
    const initializeApp = async () => {
      if (!isReady) return;

      console.log('Initializing app...');
      
      // Авторизация пользователя
      await authenticateUser(initData);
      
      // Загрузка стикерсетов
      await fetchStickerSets();
    };

    initializeApp();
  }, [isReady, initData]);

  // Управление BackButton
  useEffect(() => {
    if (tg?.BackButton && tg.BackButton.isVisible !== undefined) {
      if (viewMode === 'detail') {
        tg.BackButton.onClick(() => {
          handleBackToList();
        });
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
    }
  }, [tg, viewMode]);

  // Обработка скролла для показа/скрытия поиска
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Показываем поиск при скролле вверх или в самом верху
      if (currentScrollY < lastScrollY.current || currentScrollY < 50) {
        setShowSearch(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 150) {
        // Скрываем поиск при скролле вниз
        setShowSearch(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  if (!isReady) {
    return <LoadingSpinner message="Инициализация..." />;
  }

  if (authError) {
    return (
      <Box className="space-root fx-safe" sx={{ minHeight: '100vh' }}>
        <Header />
        <Container maxWidth={false} sx={{ 
          maxWidth: 560, 
          mx: 'auto', 
          px: 1.5, 
          pt: 'calc(8px + env(safe-area-inset-top))', 
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          backgroundColor: 'transparent'
        }}>
          <ErrorDisplay 
            error={authError || 'Ошибка авторизации'} 
            onRetry={() => authenticateUser(initData)} 
          />
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="space-root fx-safe" sx={{ minHeight: '100vh' }}>
        <Header />
        <Container maxWidth={false} sx={{ 
          maxWidth: 560, 
          mx: 'auto', 
          px: 1.5, 
          pt: 'calc(8px + env(safe-area-inset-top))', 
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          backgroundColor: 'transparent'
        }}>
          <ErrorDisplay 
            error={error || 'Ошибка загрузки'} 
            onRetry={() => fetchStickerSets()} 
          />
        </Container>
      </Box>
    );
  }

  return (
    <Box className="fx-safe" sx={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Header />
      
      <Container maxWidth={false} sx={{ 
        maxWidth: 560, 
        mx: 'auto', 
        px: 1.5, 
        pt: 'calc(8px + env(safe-area-inset-top))', 
        pb: 'calc(12px + env(safe-area-inset-bottom))',
        backgroundColor: 'transparent'
      }}>
        {/* Поисковая строка */}
        <Box
          className="tg-sticky"
          sx={{
            px: 1,
            py: 0.33,
            mb: 0.67,
            transform: showSearch ? 'translateY(0)' : 'translateY(-100%)',
            opacity: showSearch ? 1 : 0,
            transition: 'all 0.3s ease',
            pointerEvents: showSearch ? 'auto' : 'none',
            top: 0
          }}
        >
          <MinimalSearchBar 
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Поиск стикеров..."
          />
        </Box>

        {/* Категории */}
        <Box
          className="tg-sticky"
          sx={{
            px: 1,
            py: 1,
            mb: 1,
            top: showSearch ? '60px' : '0px',
            transition: 'top 0.3s ease'
          }}
        >
          <CategoriesFilter
            categories={categories}
            selectedCategories={selectedCategories}
            onCategoriesChange={handleCategoriesChange}
            loading={categoriesLoading}
          />
        </Box>

        {/* Основной контент */}
        {(viewMode || 'list') === 'list' ? (
          <>
            {isLoading && stickerSets.length === 0 ? (
              <LoadingSpinner message="Загрузка стикеров..." />
            ) : filteredStickerSets.length === 0 ? (
              <EmptyState 
                title={(searchTerm || '') ? "Ничего не найдено" : "Стикеры не найдены"}
                message={(searchTerm || '') ? "Попробуйте изменить поисковый запрос" : "Попробуйте обновить страницу"}
                actionLabel="Обновить"
                onAction={() => fetchStickerSets()}
              />
            ) : (
              <StickerSetList
                stickerSets={filteredStickerSets}
                onView={handleViewStickerSet}
                isInTelegramApp={isInTelegramApp}
              />
            )}
          </>
        ) : selectedStickerSet ? (
          <StickerSetDetail
            stickerSet={selectedStickerSet}
            onBack={handleBackToList}
            onShare={handleShareStickerSet}
            onLike={handleLikeStickerSet}
            isInTelegramApp={isInTelegramApp}
          />
        ) : (
          <LoadingSpinner message="Загрузка деталей..." />
        )}
      </Container>

      <BottomNav 
        activeTab={activeBottomTab}
        onChange={handleBottomNavChange}
        isInTelegramApp={isInTelegramApp}
      />
    </Box>
  );
};