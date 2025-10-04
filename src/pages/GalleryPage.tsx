import React, { useEffect, useState, useRef } from 'react';
import { 
  Container, 
  Box,
} from '@mui/material';
import { useTelegram } from '@/hooks/useTelegram';
import { useStickerStore } from '@/store/useStickerStore';
import { apiClient } from '@/api/client';
import { StickerSetResponse } from '@/types/sticker';

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

export const GalleryPage: React.FC = () => {
  // Хук для градиентного фона с изменением оттенка при скролле
  useScrollHue(190, 255);  // мягкая гамма: голубой → лазурно-фиолетовый
  
  // Хук для обработки безопасных зон Telegram
  useTgSafeArea();

  const { tg, user, initData, isReady, isInTelegramApp, checkInitDataExpiry } = useTelegram();
  const {
    isLoading,
    isAuthLoading,
    stickerSets,
    authStatus: _authStatus,
    error,
    authError: _authError,
    setLoading,
    setAuthLoading,
    setStickerSets,
    setAuthStatus,
    setError,
    setAuthError,
  } = useStickerStore();

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [manualInitData, setManualInitData] = useState<string>('');
  const [activeBottomTab, setActiveBottomTab] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Хук для категорий
  const { categories, loading: categoriesLoading } = useCategories();

  // Загрузка initData из URL параметров при инициализации
  useEffect(() => {
    console.log('🔍 Проверяем URL параметры и localStorage...');
    
    // Проверяем URL параметры
    const urlParams = new URLSearchParams(window.location.search);
    const urlInitData = urlParams.get('initData');
    
    // Проверяем localStorage
    const storedInitData = localStorage.getItem('telegram_init_data');
    
    // Проверяем заголовки от Chrome расширений
    const extensionInitData = apiClient.checkExtensionHeaders();
    
    if (urlInitData) {
      console.log('✅ Найден initData в URL параметрах');
      setManualInitData(decodeURIComponent(urlInitData));
      // Сохраняем в localStorage для следующих визитов
      localStorage.setItem('telegram_init_data', decodeURIComponent(urlInitData));
    } else if (storedInitData) {
      console.log('✅ Найден initData в localStorage');
      setManualInitData(storedInitData);
    } else if (extensionInitData) {
      console.log('✅ Найден initData в заголовках Chrome расширения');
      // initData уже установлен в apiClient.checkExtensionHeaders()
    } else {
      console.log('❌ initData не найден ни в URL, ни в localStorage, ни в расширениях');
    }
  }, []);

  // Перезагрузка стикерсетов при изменении категорий (только после первой загрузки)
  useEffect(() => {
    // Пропускаем первый рендер
    if (!isReady || !stickerSets.length) return;
    
    if (!searchTerm) {
      console.log('🔍 Категории изменились, перезагружаем стикерсеты:', selectedCategories);
      fetchStickerSets();
    }
  }, [selectedCategories]);

  // Проверка авторизации
  const checkAuth = async () => {
    console.log('🔍 checkAuth вызван:');
    console.log('  isInTelegramApp:', isInTelegramApp);
    console.log('  initData:', initData ? `${initData.length} chars` : 'empty');
    console.log('  manualInitData:', manualInitData ? `${manualInitData.length} chars` : 'empty');
    console.log('  user:', user);

    // Используем manualInitData если есть, иначе initData от Telegram
    const currentInitData = manualInitData || initData;

    if (!isInTelegramApp && !manualInitData && !currentInitData) {
      // В обычном браузере без авторизации - работаем без авторизации
      console.log('🌐 Браузерный режим - работаем без авторизации');
      setAuthStatus({
        authenticated: true,
        role: 'public'
      });
      return true;
    }
    
    if (!currentInitData) {
      console.log('⚠️ initData отсутствует');
      setAuthStatus({
        authenticated: false,
        role: 'anonymous'
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
        console.log('🔍 Проверка initData:', initDataCheck);
        if (!initDataCheck.valid) {
          throw new Error(initDataCheck.reason);
        }
      } else {
        console.log('🔍 Тестовые данные - пропускаем проверку срока действия');
      }

      // Устанавливаем заголовки аутентификации
      apiClient.setAuthHeaders(currentInitData);

      // Проверяем статус авторизации
      console.log('🔍 Отправка запроса на проверку авторизации...');
      const authResponse = await apiClient.checkAuthStatus();
      console.log('🔍 Ответ авторизации:', authResponse);
      setAuthStatus(authResponse);

      if (!authResponse.authenticated) {
        throw new Error(authResponse.message || 'Ошибка авторизации');
      }

      return true;
    } catch (error) {
      console.error('❌ Ошибка авторизации:', error);
      
      // Более детальная обработка ошибок авторизации
      let errorMessage = 'Ошибка авторизации';
      
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
      return false;
    } finally {
      setAuthLoading(false);
    }
  };


  // Загрузка стикерсетов
  const fetchStickerSets = async (page: number = 0) => {
    setLoading(true);
    setError(null);

    try {
      // Загружаем стикерсеты с фильтрацией по категориям
      const response = await apiClient.getStickerSetsWithCategories(
        page, 
        20, 
        selectedCategories.length > 0 ? selectedCategories : undefined
      );
      setStickerSets(response.content || []);
    } catch (error) {
      console.error('❌ Ошибка загрузки стикеров:', error);
      
      // Более детальная обработка ошибок
      let errorMessage = 'Ошибка загрузки стикеров';
      
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
      const response = await apiClient.searchStickerSets(query);
      setStickerSets(response.content || []);
    } catch (error) {
      console.error('❌ Ошибка поиска стикеров:', error);
      
      // Более детальная обработка ошибок поиска
      let errorMessage = 'Ошибка поиска стикеров';
      
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

  // Обработчик изменения категорий
  const handleCategoriesChange = (newCategories: string[]) => {
    setSelectedCategories(newCategories);
  };

  // Обработчики действий
  const handleViewStickerSet = (id: number, _name: string) => {
    const stickerSet = stickerSets.find(s => s.id === id);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setViewMode('detail');
    }
  };

  const handleShareStickerSet = (name: string, _title: string) => {
    if (tg) {
      tg.openTelegramLink(`https://t.me/addstickers/${name}`);
    } else {
      // Fallback для браузера
      window.open(`https://t.me/addstickers/${name}`, '_blank');
    }
  };

  const handleLikeStickerSet = (id: number, title: string) => {
    // TODO: Реализовать API для лайков
    console.log(`Лайк стикерсета: ${title} (ID: ${id})`);
    alert(`Лайк для "${title}" будет реализован в будущем!`);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedStickerSet(null);
  };

  const handleCreateSticker = () => {
    if (tg) {
      tg.openTelegramLink('https://t.me/StickerGalleryBot');
    } else {
      window.open('https://t.me/StickerGalleryBot', '_blank');
    }
  };

  const handleMenuClick = () => {
    console.log('🔍 Меню нажато');
    // TODO: Реализовать боковое меню
  };

  const handleOptionsClick = () => {
    console.log('🔍 Опции нажаты');
    // TODO: Реализовать меню опций
  };

  // Обработка поиска
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    // Дебаунс поиска
    const delayedSearch = setTimeout(() => {
      searchStickerSets(newSearchTerm);
    }, 500);

    return () => clearTimeout(delayedSearch);
  };

  // Фильтрация стикерсетов (локальная фильтрация + серверный поиск)
  const filteredStickerSets = stickerSets.filter(stickerSet =>
    stickerSet.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  console.log('🔍 GalleryPage состояние:', {
    stickerSets: stickerSets.length,
    filteredStickerSets: filteredStickerSets.length,
    searchTerm,
    viewMode,
    isInTelegramApp,
    isLoading,
    isAuthLoading
  });

  // Инициализация при загрузке
  useEffect(() => {
    const initializeApp = async () => {
      if (!isReady) return;
      
      // Сначала проверяем авторизацию
      await checkAuth();
      
      // Затем загружаем стикерсеты
      await fetchStickerSets();
    };
    
    initializeApp();
  }, [isReady, manualInitData]); // Добавляем manualInitData в зависимости

  // Обработка кнопки "Назад" в Telegram
  useEffect(() => {
    if (tg?.BackButton && tg.BackButton.isVisible !== undefined) {
      tg.BackButton.onClick(() => {
        if (viewMode === 'detail') {
          handleBackToList();
        } else {
          tg.close();
        }
      });

      if (viewMode === 'detail') {
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
    }
  }, [tg, viewMode]);

  // Отслеживание скролла для показа/скрытия поиска
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Показываем поиск при скролле вверх или если находимся вверху страницы
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setShowSearch(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Скрываем поиск при скролле вниз, но только если прокрутили достаточно
        setShowSearch(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  if (!isReady) {
    return <LoadingSpinner message="Инициализация..." />;
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: 'transparent',
      paddingBottom: isInTelegramApp ? 0 : 8 // Отступ для BottomNav в браузере
    }}>
      {/* Заголовок */}
      <Header 
        title="🎨 Галерея стикеров"
        onMenuClick={handleMenuClick}
        onOptionsClick={handleOptionsClick}
        initData={initData}
        user={user}
      />

      <Container 
        maxWidth={false} 
        sx={{ 
          maxWidth: 560, 
          mx: 'auto', 
          px: 1.5, 
          pt: 'calc(8px + env(safe-area-inset-top))',
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          backgroundColor: 'transparent'
        }}
      >
        {viewMode === 'list' ? (
          <>
            {/* Sticky поиск и чипы */}
            <Box 
              className="tg-sticky" 
              sx={{ 
                px: 1, 
                py: 0.33, 
                mb: 0.67,
                transform: showSearch ? 'translateY(0)' : 'translateY(-100%)',
                opacity: showSearch ? 1 : 0,
                transition: 'transform 0.3s ease, opacity 0.3s ease',
                pointerEvents: showSearch ? 'auto' : 'none'
              }}
            >
              <MinimalSearchBar
                value={searchTerm}
                onChange={handleSearchChange}
                disabled={isLoading}
              />
              <Box sx={{ mt: 1 }}>
                <CategoriesFilter
                  categories={categories}
                  selectedCategories={selectedCategories}
                  onCategoriesChange={handleCategoriesChange}
                  loading={categoriesLoading}
                />
              </Box>
            </Box>

            {/* Контент */}
            {isLoading ? (
              <LoadingSpinner message="Загрузка стикеров..." />
            ) : error ? (
              <ErrorDisplay error={error} onRetry={() => fetchStickerSets()} />
            ) : filteredStickerSets.length === 0 ? (
              <EmptyState
                title="🎨 Стикеры не найдены"
                message={searchTerm ? 'По вашему запросу ничего не найдено' : 'У вас пока нет созданных наборов стикеров'}
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
          </>
        ) : (
          // Детальный просмотр стикерсета
          selectedStickerSet && (
            <StickerSetDetail
              stickerSet={selectedStickerSet}
              onBack={handleBackToList}
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
