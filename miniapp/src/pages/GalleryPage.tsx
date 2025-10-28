import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useStickerStore } from '../store/useStickerStore';
import { useLikesStore } from '../store/useLikesStore';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { apiClient } from '../api/client';
import { StickerSetResponse } from '../types/sticker';

// Новые Telegram-style компоненты
import { TelegramLayout } from '../components/TelegramLayout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { EmptyState } from '../components/EmptyState';
import { DebugPanel } from '../components/DebugPanel';
import { StickerPackModal } from '../components/StickerPackModal';
import { SearchBar } from '../components/SearchBar';

// Новые компоненты галереи
import { SimpleGallery } from '../components/SimpleGallery';
import { adaptStickerSetsToGalleryPacks } from '../utils/galleryAdapter';

export const GalleryPage: React.FC = () => {
  const { tg, user, initData, isReady, isInTelegramApp, isMockMode } = useTelegram();
  const {
    isLoading,
    stickerSets,
    error,
    currentPage,
    totalPages,
    totalElements,
    setLoading,
    setStickerSets,
    addStickerSets,
    setError,
    setPagination,
  } = useStickerStore();
  const { checkAuth } = useAuth();
  const { initializeLikes } = useLikesStore();

  // Оптимизированное локальное состояние
  const [uiState, setUiState] = useState({
    searchTerm: '',
    selectedStickerSet: null as StickerSetResponse | null,
    isDetailOpen: false,
    manualInitData: '',
    isLoadingMore: false
  });

  // Debounced search term для оптимизации поиска
  const debouncedSearchTerm = useDebounce(uiState.searchTerm, 500);

  // Загрузка initData из URL параметров при инициализации
  // BUILD_DEBUG: Force rebuild - timestamp 2025-10-28T14:30:00Z
  useEffect(() => {
    console.log('🚀 DEBUG: GalleryPage INIT - BUILD: 2025-10-28T12:25:00Z');
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlInitData = urlParams.get('initData');
    
    // Важно: используем переменную СРАЗУ после определения, чтобы minifier не выбросил её
    const storedInitData = localStorage.getItem('telegram_init_data');
    const hasStored = !!storedInitData; // используем переменную
    
    const extensionInitData = apiClient.checkExtensionHeaders();
    
    console.log('🔍 DEBUG: urlInitData:', urlInitData ? 'EXISTS' : 'NULL');
    console.log('🔍 DEBUG: storedInitData:', storedInitData ? 'EXISTS' : 'NULL');
    console.log('🔍 DEBUG: extensionInitData:', extensionInitData ? 'EXISTS' : 'NULL');
    console.log('✅ hasStored:', hasStored);
    
    if (urlInitData) {
      setUiState(prev => ({ ...prev, manualInitData: decodeURIComponent(urlInitData) }));
      localStorage.setItem('telegram_init_data', decodeURIComponent(urlInitData));
    } else if (storedInitData) {
      setUiState(prev => ({ ...prev, manualInitData: storedInitData }));
    } else if (extensionInitData) {
      // initData уже установлен
    } else {
      // В production без initData - используем пустую строку
      console.log('🔧 PRODUCTION MODE: initData не найден, используем пустую строку');
      setUiState(prev => ({ ...prev, manualInitData: '' }));
    }
  }, []);

  // Загрузка стикерсетов - исправлена циклическая зависимость
  const fetchStickerSets = useCallback(async (page: number = 0, isLoadMore: boolean = false) => {
    if (isLoadMore) {
      setUiState(prev => ({ ...prev, isLoadingMore: true }));
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Проверяем авторизацию напрямую без промежуточных функций
      const currentInitData = uiState.manualInitData || initData;
      
      // В production без initData - пропускаем авторизацию
      if (!currentInitData && !isInTelegramApp) {
        console.log('🔧 PRODUCTION MODE: Пропускаем авторизацию, загружаем данные напрямую');
      } else {
        const isAuthenticated = await checkAuth(currentInitData);
        
        if (!isAuthenticated && isInTelegramApp && !isMockMode) {
          throw new Error('Пользователь не авторизован');
        }
      }

      const response = await apiClient.getStickerSets(page);
      
      if (isLoadMore) {
        // Добавляем новые стикерсеты к существующим
        addStickerSets(response.content || []);
      } else {
        // Заменяем все стикерсеты
        setStickerSets(response.content || []);
      }
      
      // Инициализируем лайки из API данных
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content);
      }
      
      // Обновляем информацию о пагинации
      setPagination(
        response.number || page,
        response.totalPages || 0,
        response.totalElements || 0
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки стикеров';
      
      // В dev режиме показываем ошибку, но не блокируем интерфейс
      if (isMockMode || !isInTelegramApp) {
        console.warn('⚠️ API недоступен, показываем пустое состояние:', errorMessage);
        if (!isLoadMore) {
          setStickerSets([]); // Пустой массив вместо ошибки
        }
      } else {
        setError(errorMessage);
      }
      
      console.error('❌ Ошибка загрузки стикеров:', error);
    } finally {
      if (isLoadMore) {
        setUiState(prev => ({ ...prev, isLoadingMore: false }));
      } else {
        setLoading(false);
      }
    }
  }, [uiState.manualInitData, initData, checkAuth, isInTelegramApp, isMockMode, setLoading, setError, setStickerSets, addStickerSets, setPagination, initializeLikes]);

  // Загрузка следующей страницы
  const loadMoreStickerSets = useCallback(() => {
    if (currentPage < totalPages - 1 && !uiState.isLoadingMore) {
      fetchStickerSets(currentPage + 1, true);
    }
  }, [currentPage, totalPages, uiState.isLoadingMore, fetchStickerSets]);

  // Поиск стикерсетов
  const searchStickerSets = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchStickerSets();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.searchStickerSets(query);
      setStickerSets(response.content || []);
      
      // Инициализируем лайки из результатов поиска
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка поиска стикеров';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchStickerSets, setLoading, setError, setStickerSets, initializeLikes]);

  // Мемоизированные обработчики
  const handleViewStickerSet = useCallback((id: number | string) => {
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
    
    const stickerSet = stickerSets.find(s => s.id.toString() === id.toString());
    if (stickerSet) {
      setUiState(prev => ({
        ...prev,
        selectedStickerSet: stickerSet,
        isDetailOpen: true
      }));
    }
  }, [tg, stickerSets]);

  const handleBackToList = useCallback(() => {
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    setUiState(prev => ({
      ...prev,
      isDetailOpen: false,
      selectedStickerSet: null
    }));
  }, [tg]);

  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setUiState(prev => ({ ...prev, searchTerm: newSearchTerm }));
  }, []);

  const handleSearch = useCallback((searchTerm: string) => {
    if (searchTerm.trim()) {
      searchStickerSets(searchTerm);
    } else {
      fetchStickerSets();
    }
  }, [searchStickerSets, fetchStickerSets]);

  // Debounced поиск отключен - поиск только по требованию (Enter или клик)
  // useEffect(() => {
  //   if (debouncedSearchTerm) {
  //     searchStickerSets(debouncedSearchTerm);
  //   }
  // }, [debouncedSearchTerm, searchStickerSets]);

  // Оптимизированная фильтрация с мемоизацией
  const filteredStickerSets = useMemo(() => 
    stickerSets.filter(stickerSet =>
      stickerSet.title.toLowerCase().includes(uiState.searchTerm.toLowerCase())
    ), [stickerSets, uiState.searchTerm]
  );

  // Мемоизация адаптированных данных для галереи
  const galleryPacks = useMemo(() => 
    adaptStickerSetsToGalleryPacks(filteredStickerSets), 
    [filteredStickerSets]
  );

  // Инициализация - исправлен бесконечный цикл
  useEffect(() => {
    if (isReady) {
      fetchStickerSets();
    }
  }, [isReady, uiState.manualInitData]); // Убрали fetchStickerSets из зависимостей

  if (!isReady) {
    return <LoadingSpinner message="Инициализация..." />;
  }

  // Детальная модалка поверх списка

  return (
    <>
      <TelegramLayout>

        {/* Search Bar */}
        <SearchBar
          value={uiState.searchTerm}
          onChange={handleSearchChange}
          onSearch={handleSearch}
          placeholder="Поиск стикеров..."
          disabled={isLoading}
        />



        {/* Content */}
        {isLoading ? (
          <LoadingSpinner message="Загрузка стикеров..." />
        ) : error ? (
          <ErrorDisplay error={error} onRetry={() => fetchStickerSets()} />
        ) : filteredStickerSets.length === 0 ? (
          <EmptyState
            title="🎨 Стикеры не найдены"
            message={uiState.searchTerm ? 'По вашему запросу ничего не найдено' : 'У вас пока нет созданных наборов стикеров'}
            actionLabel="Создать стикер"
            onAction={() => {
              if (tg) {
                tg.openTelegramLink('https://t.me/StickerGalleryBot');
              }
            }}
          />
        ) : (
          <div className="fade-in">
            <SimpleGallery
              packs={galleryPacks}
              onPackClick={handleViewStickerSet}
              hasNextPage={currentPage < totalPages - 1}
              isLoadingMore={uiState.isLoadingMore}
              onLoadMore={loadMoreStickerSets}
              enablePreloading={true}
            />
          </div>
        )}
      </TelegramLayout>
      <DebugPanel initData={initData} />
      <StickerPackModal 
        open={uiState.isDetailOpen} 
        stickerSet={uiState.selectedStickerSet} 
        onClose={handleBackToList}
        onLike={(id, title) => {
          console.log(`Лайк для стикерсета ${id}: ${title}`);
        }}
      />
    </>
  );
};
