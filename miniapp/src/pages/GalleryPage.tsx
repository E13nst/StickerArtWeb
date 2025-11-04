import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
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
import { CategoryFilter, Category } from '../components/CategoryFilter';
import { UploadStickerPackModal } from '../components/UploadStickerPackModal';
import { AddStickerPackButton } from '../components/AddStickerPackButton';
import { SortButton } from '../components/SortButton';

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
  const { initializeLikes, syncPendingLikes } = useLikesStore();

  // Категории стикеров (загружаются с API)
  const [categories, setCategories] = useState<Category[]>([]);

  // Адаптер для преобразования CategoryResponse в Category для UI
  const adaptCategoriesToUI = useCallback((apiCategories: typeof apiClient extends { getCategories(): Promise<infer T> } ? Awaited<T> : never): Category[] => {
    return apiCategories.map(cat => ({
      id: cat.key,
      label: cat.name,
      title: cat.description
    }));
  }, []);

  // Оптимизированное локальное состояние
  const [uiState, setUiState] = useState({
    searchTerm: '',
    selectedStickerSet: null as StickerSetResponse | null,
    isDetailOpen: false,
    manualInitData: '',
    isLoadingMore: false,
    isUploadModalOpen: false,
    selectedCategories: [] as string[],
    sortByLikes: false
  });

  // Debounced search term для оптимизации поиска
  const debouncedSearchTerm = useDebounce(uiState.searchTerm, 500);

  // Загрузка initData из URL параметров при инициализации
  // BUILD_DEBUG: Force rebuild - timestamp 2025-10-28T14:30:00Z
  useEffect(() => {
    console.log('🚀 DEBUG: GalleryPage INIT - BUILD: 2025-10-28T12:25:00Z');
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlInitData = urlParams.get('initData');
    
    // ВАЖНО ДЛЯ СБОРКИ:
    // 1) Переменная storedInitData должна быть ИСПОЛЬЗОВАНА сразу после объявления.
    // 2) Иначе минификатор (esbuild/terser) может решить, что она "неиспользуется",
    //    удалить её и сломать детекцию initData из localStorage в production.
    // 3) Не переносите и не удаляйте проверку hasStored — порядок важен.
    // 4) Не рефакторить в "ленивое" использование через позже вычисляемые функции.
    //    Нам нужен прямой side‑effect обращения к localStorage.
    //
    // Если потребуется правка — сверяйтесь с DEBUG логами ниже и обязательно
    // проверяйте production сборку, а не только dev.
    //
    // Ранее это уже ломалось при минификации — оставляем явные комментарии.
    const storedInitData = localStorage.getItem('telegram_init_data');
    const hasStored = !!storedInitData; // не удалять: явное использование защищает от минификатора
    
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

  // Загрузка стикерсетов - с поддержкой фильтрации по категориям
  const fetchStickerSets = useCallback(async (
    page: number = 0, 
    isLoadMore: boolean = false,
    filterCategories?: string[]
  ) => {
    if (isLoadMore) {
      setUiState(prev => ({ ...prev, isLoadingMore: true }));
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Проверяем авторизацию напрямую без промежуточных функций
      const currentInitData = uiState.manualInitData || initData;
      
      // Публичная галерея - авторизация необязательна, делаем неблокирующей
      if (currentInitData) {
        // Запускаем авторизацию в фоне, не блокируя загрузку данных
        checkAuth(currentInitData).catch(error => {
          console.warn('⚠️ Фоновая авторизация не удалась, но продолжаем работу:', error);
        });
      } else {
        console.log('🔧 Режим без авторизации: загружаем публичные данные');
      }

      // Загружаем данные с фильтром по категориям и сортировкой
      // При включенной сортировке по лайкам: сортировка по likesCount DESC (от самых лайкнутых)
      // При выключенной: сортировка по id DESC (последние добавленные)
      const response = await apiClient.getStickerSets(page, 20, {
        categoryKeys: filterCategories && filterCategories.length > 0 ? filterCategories : undefined,
        sort: uiState.sortByLikes ? 'likesCount' : 'id',
        direction: 'DESC'
      });
      
      if (isLoadMore) {
        // Добавляем новые стикерсеты к существующим
        addStickerSets(response.content || []);
      } else {
        // Заменяем все стикерсеты
        setStickerSets(response.content || []);
      }
      
      // Инициализируем лайки из API данных
      // При загрузке дополнительных страниц используем mergeMode=true для защиты от перезаписи
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content, isLoadMore);
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
  }, [uiState.manualInitData, uiState.sortByLikes, initData, checkAuth, isInTelegramApp, isMockMode, setLoading, setError, setStickerSets, addStickerSets, setPagination, initializeLikes]);

  // Загрузка следующей страницы с учетом фильтров
  const loadMoreStickerSets = useCallback(() => {
    if (currentPage < totalPages - 1 && !uiState.isLoadingMore) {
      fetchStickerSets(currentPage + 1, true, uiState.selectedCategories);
    }
  }, [currentPage, totalPages, uiState.isLoadingMore, uiState.selectedCategories, fetchStickerSets]);

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
        console.log('🔍 DEBUG: Инициализация лайков из поиска:', response.content.map(s => ({
          id: s.id,
          title: s.title,
          likes: s.likes,
          isLiked: s.isLiked
        })));
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

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setUiState(prev => {
      const isSelected = prev.selectedCategories.includes(categoryId);
      const newCategories = isSelected
        ? prev.selectedCategories.filter(id => id !== categoryId)
        : [...prev.selectedCategories, categoryId];
      
      return { ...prev, selectedCategories: newCategories };
    });
  }, []);

  const handleSortToggle = useCallback(() => {
    setUiState(prev => ({ ...prev, sortByLikes: !prev.sortByLikes }));
  }, []);

  // Debounced поиск отключен - поиск только по требованию (Enter или клик)
  // useEffect(() => {
  //   if (debouncedSearchTerm) {
  //     searchStickerSets(debouncedSearchTerm);
  //   }
  // }, [debouncedSearchTerm, searchStickerSets]);

  // Оптимизированная фильтрация с мемоизацией (только по локальному поисковому запросу)
  // Фильтрация по категориям теперь происходит на сервере через API
  const filteredStickerSets = useMemo(() => {
    let filtered = stickerSets;

    // Фильтр по поисковому запросу (локальный)
    if (uiState.searchTerm.trim()) {
      filtered = filtered.filter(stickerSet =>
        stickerSet.title.toLowerCase().includes(uiState.searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [stickerSets, uiState.searchTerm]);

  // Мемоизация адаптированных данных для галереи
  const galleryPacks = useMemo(() => 
    adaptStickerSetsToGalleryPacks(filteredStickerSets), 
    [filteredStickerSets]
  );

  // Загрузка категорий при инициализации
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await apiClient.getCategories();
        const adaptedCategories = adaptCategoriesToUI(categoriesData);
        setCategories(adaptedCategories);
      } catch (error) {
        console.error('❌ Ошибка загрузки категорий:', error);
      }
    };

    loadCategories();
  }, [adaptCategoriesToUI]);

  // Перезагрузка при изменении выбранных категорий или сортировки
  useEffect(() => {
    if (isReady) {
      fetchStickerSets(0, false, uiState.selectedCategories);
    }
  }, [uiState.selectedCategories, uiState.sortByLikes]); // Реагируем на изменение категорий и сортировки

  // Инициализация - исправлен бесконечный цикл
  useEffect(() => {
    if (isReady) {
      fetchStickerSets(0, false, uiState.selectedCategories);
    }
  }, [isReady, uiState.manualInitData]); // Убрали fetchStickerSets из зависимостей

  // Автоматическая синхронизация offline очереди лайков
  useEffect(() => {
    // Синхронизируем при загрузке страницы
    syncPendingLikes().catch(err => {
      console.warn('⚠️ Не удалось синхронизировать offline лайки:', err);
    });

    // Слушаем событие восстановления сети
    const handleOnline = () => {
      console.log('🌐 Сеть восстановлена. Синхронизация offline лайков...');
      syncPendingLikes().catch(err => {
        console.warn('⚠️ Не удалось синхронизировать offline лайки при восстановлении сети:', err);
      });
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncPendingLikes]);

  if (!isReady) {
    return <LoadingSpinner message="Инициализация..." />;
  }

  // Детальная модалка поверх списка

  return (
    <>
      <TelegramLayout>

        {/* Search Bar with Sort Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.618rem', mb: '0.618rem', px: '0.618rem' }}>
          <Box sx={{ flex: 1 }}>
            <SearchBar
              value={uiState.searchTerm}
              onChange={handleSearchChange}
              onSearch={handleSearch}
              placeholder="Поиск стикеров..."
              disabled={isLoading}
            />
          </Box>
          <SortButton
            sortByLikes={uiState.sortByLikes}
            onToggle={handleSortToggle}
            disabled={isLoading || !!uiState.searchTerm || categories.length === 0}
          />
        </Box>

        {/* Category Filter */}
        {categories.length > 0 && (
          <Box sx={{ mb: '0.618rem' }}>
            <CategoryFilter
              categories={categories}
              selectedCategories={uiState.selectedCategories}
              onCategoryToggle={handleCategoryToggle}
              disabled={isLoading}
            />
          </Box>
        )}

        

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner message="Загрузка стикеров..." />
        ) : error ? (
          <ErrorDisplay error={error} onRetry={() => fetchStickerSets()} />
        ) : filteredStickerSets.length === 0 ? (
          <EmptyState
            title="🎨 Стикеры не найдены"
            message={
              uiState.selectedCategories.length > 0 
                ? `Нет стикеров с выбранными категориями. Попробуйте снять фильтр или выбрать другие категории.`
                : uiState.searchTerm 
                  ? 'По вашему запросу ничего не найдено' 
                  : 'У вас пока нет созданных наборов стикеров'
            }
            actionLabel={uiState.selectedCategories.length > 0 ? undefined : "Создать стикер"}
            onAction={uiState.selectedCategories.length > 0 ? undefined : () => {
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
              addButtonElement={
                <AddStickerPackButton
                  variant="gallery"
                  onClick={() => setUiState(prev => ({ ...prev, isUploadModalOpen: true }))}
                />
              }
            />
          </div>
        )}
      </TelegramLayout>
      <DebugPanel initData={initData} />
      <UploadStickerPackModal
        open={uiState.isUploadModalOpen}
        onClose={() => setUiState(prev => ({ ...prev, isUploadModalOpen: false }))}
        onUpload={async (link: string) => {
          // Обновляем список стикерсетов после успешной загрузки
          await fetchStickerSets();
          setUiState(prev => ({ ...prev, isUploadModalOpen: false }));
        }}
      />
      <StickerPackModal 
        open={uiState.isDetailOpen} 
        stickerSet={uiState.selectedStickerSet} 
        onClose={handleBackToList}
        onLike={(id, title) => {
          console.log(`Лайк для стикерсета ${id}: ${title}`);
        }}
      />
      <UploadStickerPackModal
        open={uiState.isUploadModalOpen}
        onClose={() => setUiState(prev => ({ ...prev, isUploadModalOpen: false }))}
        onUpload={async (link: string) => {
          await apiClient.uploadStickerPackByLink(link);
          // Обновляем галерею после успешной загрузки
          await fetchStickerSets(0, false, uiState.selectedCategories);
        }}
      />
    </>
  );
};
