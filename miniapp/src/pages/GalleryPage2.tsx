import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useStickerStore } from '../store/useStickerStore';
import { useLikesStore } from '../store/useLikesStore';
import { useProfileStore } from '../store/useProfileStore';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../api/client';
import { StickerSetResponse } from '../types/sticker';

import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { EmptyState } from '../components/EmptyState';
import { StickerPackModal } from '../components/StickerPackModal';
import { OptimizedGallery } from '../components/OptimizedGallery';
import { adaptStickerSetsToGalleryPacks } from '../utils/galleryAdapter';
import { Category } from '../components/CategoryFilter';
import { CompactControlsBar } from '../components/CompactControlsBar';
import { StickerSetType } from '../components/StickerSetTypeFilter';
import { useScrollElement } from '../contexts/ScrollContext';
import { StixlyPageContainer } from '../components/layout/StixlyPageContainer';
import { useGalleryContext } from '../contexts/GalleryContext';
import { GallerySearchBar } from '../components/GallerySearchBar';
import '../styles/GalleryPage.css';

const GalleryPage2Content: React.FC = () => {
  const { tg, user, initData, isReady, isInTelegramApp, isMockMode } = useTelegram();
  const scrollElement = useScrollElement();
  const [searchParams, setSearchParams] = useSearchParams();
  const { searchTerm, setSearchTerm: setContextSearchTerm, handleSearch: contextHandleSearch, showFilters, setShowFilters } = useGalleryContext();
  
  const {
    isLoading,
    stickerSets,
    error,
    currentPage,
    totalPages,
    setLoading,
    setStickerSets,
    addStickerSets,
    setError,
    setPagination,
  } = useStickerStore();
  
  const { checkAuth } = useAuth();
  const initializeLikes = useLikesStore(state => state.initializeLikes);
  const { userInfo, setUserInfo } = useProfileStore();

  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [manualInitData, setManualInitData] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortByLikes, setSortByLikes] = useState(false);
  const [selectedStickerSetTypes, setSelectedStickerSetTypes] = useState<StickerSetType[]>([]);
  const [selectedStickerTypes, setSelectedStickerTypes] = useState<string[]>(['static', 'animated', 'video', 'official']);
  const [selectedDate, setSelectedDate] = useState<string | null>('all');
  const [categories, setCategories] = useState<Category[]>([]);

  const initialSetId = searchParams.get('set_id');
  const hasInitializedRef = useRef(false);
  const lastFiltersRef = useRef<{ 
    categories: string[], 
    sortByLikes: boolean, 
    stickerSetTypes: StickerSetType[], 
    searchTerm: string 
  }>({
    categories: [],
    sortByLikes: false,
    stickerSetTypes: [],
    searchTerm: ''
  });

  const sortByLikesRef = useRef(sortByLikes);
  const manualInitDataRef = useRef(manualInitData);

  useEffect(() => {
    sortByLikesRef.current = sortByLikes;
    manualInitDataRef.current = manualInitData;
  }, [sortByLikes, manualInitData]);

  // Инициализация initData
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlInitData = urlParams.get('initData');
    const storedInitData = localStorage.getItem('telegram_init_data');
    const extensionInitData = apiClient.checkExtensionHeaders();
    
    if (urlInitData) {
      setManualInitData(decodeURIComponent(urlInitData));
      localStorage.setItem('telegram_init_data', decodeURIComponent(urlInitData));
    } else if (storedInitData) {
      setManualInitData(storedInitData);
    }
  }, []);

  // Установка заголовков авторизации
  useEffect(() => {
    const currentInitData = manualInitData || initData;
    if (currentInitData) {
      apiClient.setAuthHeaders(currentInitData);
    } else {
      apiClient.checkExtensionHeaders();
    }
  }, [initData, manualInitData]);

  // Загрузка стикерсетов
  const fetchStickerSets = useCallback(async (
    page: number = 0, 
    isLoadMore: boolean = false,
    filterCategories?: string[]
  ) => {
    if (isLoadMore && isLoadingMore) return;
    
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const currentInitData = manualInitDataRef.current || initData;
      if (currentInitData) {
        checkAuth(currentInitData).catch(() => {});
      }

      let typeFilter: 'USER' | 'OFFICIAL' | undefined = undefined;
      if (selectedStickerSetTypes.length === 1) {
        typeFilter = selectedStickerSetTypes[0];
      }

      const apiOptions = {
        categoryKeys: filterCategories && filterCategories.length > 0 ? filterCategories : undefined,
        type: typeFilter,
        sort: sortByLikesRef.current ? 'likesCount' : 'id',
        direction: 'DESC' as const,
        preview: true
      };

      const searchQuery = lastFiltersRef.current.searchTerm.trim();
      let response;

      if (searchQuery) {
        response = await apiClient.searchStickerSets(searchQuery, page, 20, apiOptions);
      } else {
        response = await apiClient.getStickerSets(page, 20, apiOptions);
      }
      
      if (isLoadMore) {
        addStickerSets(response.content || []);
      } else {
        setStickerSets(response.content || []);
      }
      
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content, isLoadMore);
      }
      
      setPagination(
        response.number ?? page,
        response.totalPages ?? 0,
        response.totalElements ?? 0
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки стикеров';
      if (isMockMode || !isInTelegramApp) {
        if (!isLoadMore) {
          setStickerSets([]);
        }
      } else {
        setError(errorMessage);
      }
      console.error('❌ Ошибка загрузки стикеров:', error);
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [initData, checkAuth, isInTelegramApp, isMockMode, setLoading, setError, setStickerSets, addStickerSets, setPagination, initializeLikes, selectedStickerSetTypes]);

  // Загрузка следующей страницы
  const loadMoreStickerSets = useCallback(() => {
    if (currentPage >= totalPages - 1 || isLoadingMore) return;
    fetchStickerSets(currentPage + 1, true, selectedCategories);
  }, [currentPage, totalPages, isLoadingMore, selectedCategories, fetchStickerSets]);

  // Обработчики
  const handleViewStickerSet = useCallback((id: number | string) => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
    
    const stickerSet = stickerSets.find(s => s.id.toString() === id.toString());
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsDetailOpen(true);
      setSearchParams({ set_id: id.toString() }, { replace: false });
    }
  }, [tg, stickerSets, setSearchParams]);

  const handleBackToList = useCallback(() => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    setIsDetailOpen(false);
    setSelectedStickerSet(null);
    setSearchParams({}, { replace: true });
  }, [tg, setSearchParams]);

  const handleSearch = useCallback((searchTerm: string) => {
    contextHandleSearch(searchTerm);
    lastFiltersRef.current = {
      ...lastFiltersRef.current,
      searchTerm: searchTerm
    };
    fetchStickerSets(0, false, selectedCategories);
  }, [contextHandleSearch, fetchStickerSets, selectedCategories]);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(categoryId);
      return isSelected
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId];
    });
  }, []);

  const handleSortToggle = useCallback(() => {
    setSortByLikes(prev => !prev);
  }, []);

  const handleStickerSetTypeToggle = useCallback((type: StickerSetType) => {
    setSelectedStickerSetTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  }, []);

  const handleStickerTypeToggle = useCallback((typeId: string) => {
    setSelectedStickerTypes(prev => {
      const isSelected = prev.includes(typeId);
      return isSelected
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId];
    });
  }, []);

  const handleDateChange = useCallback((dateId: string) => {
    setSelectedDate(dateId);
  }, []);

  const handleApplyFilters = useCallback(() => {
    if (!isReady || !hasInitializedRef.current) return;
    
    lastFiltersRef.current = {
      categories: [...selectedCategories],
      sortByLikes: sortByLikes,
      stickerSetTypes: [...selectedStickerSetTypes],
      searchTerm: lastFiltersRef.current.searchTerm
    };
    fetchStickerSets(0, false, selectedCategories);
  }, [isReady, selectedCategories, sortByLikes, selectedStickerSetTypes, fetchStickerSets]);

  // Применение фильтров
  useEffect(() => {
    if (!isReady || !hasInitializedRef.current) return;
    
    const categoriesChanged = JSON.stringify(selectedCategories) !== JSON.stringify(lastFiltersRef.current.categories);
    const sortChanged = sortByLikes !== lastFiltersRef.current.sortByLikes;
    const typesChanged = JSON.stringify(selectedStickerSetTypes) !== JSON.stringify(lastFiltersRef.current.stickerSetTypes);
    
    if (categoriesChanged || sortChanged || typesChanged) {
      lastFiltersRef.current = {
        categories: [...selectedCategories],
        sortByLikes: sortByLikes,
        stickerSetTypes: [...selectedStickerSetTypes],
        searchTerm: lastFiltersRef.current.searchTerm
      };
      fetchStickerSets(0, false, selectedCategories);
    }
  }, [selectedCategories, sortByLikes, selectedStickerSetTypes, isReady, fetchStickerSets]);

  // Инициализация
  useEffect(() => {
    if (isReady && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      lastFiltersRef.current = {
        categories: [...selectedCategories],
        sortByLikes: sortByLikes,
        stickerSetTypes: [...selectedStickerSetTypes],
        searchTerm: ''
      };
      fetchStickerSets(0, false, selectedCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]); // Используем только isReady, остальные значения читаем через refs/state внутри эффекта

  // Загрузка категорий
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await apiClient.getCategories();
        setCategories(categoriesData.map(cat => ({
          id: cat.key,
          label: cat.name,
          title: cat.description
        })));
      } catch (error) {
        console.error('❌ Ошибка загрузки категорий:', error);
      }
    };
    loadCategories();
  }, []);

  // Открытие модалки из URL
  useEffect(() => {
    const isInitialLoading = isLoading && stickerSets.length === 0 && !error;
    if (!initialSetId || isDetailOpen || isInitialLoading || stickerSets.length === 0) {
      return;
    }

    const foundSet = stickerSets.find(s => s.id.toString() === initialSetId);
    if (foundSet) {
      setSelectedStickerSet(foundSet);
      setIsDetailOpen(true);
    }
  }, [initialSetId, isDetailOpen, isLoading, stickerSets, error]);

  // Адаптация данных для галереи
  const galleryPacks = useMemo(() => 
    adaptStickerSetsToGalleryPacks(stickerSets), 
    [stickerSets]
  );

  if (!isReady) {
    return <LoadingSpinner message="Инициализация..." />;
  }

  const isInitialLoading = isLoading && stickerSets.length === 0 && !error;

  return (
    <div className="gallery-page">
      {!isInitialLoading && showFilters && (
        <CompactControlsBar
          searchValue={searchTerm}
          onSearchChange={setContextSearchTerm}
          onSearch={handleSearch}
          searchDisabled={false}
          categories={categories}
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
          categoriesDisabled={false}
          sortByLikes={sortByLikes}
          onSortToggle={handleSortToggle}
          sortDisabled={!!searchTerm || categories.length === 0}
          selectedStickerTypes={selectedStickerTypes}
          onStickerTypeToggle={handleStickerTypeToggle}
          selectedStickerSetTypes={selectedStickerSetTypes}
          onStickerSetTypeToggle={handleStickerSetTypeToggle}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onApplyFilters={handleApplyFilters}
          onAddClick={() => {}}
          variant="fixed"
        />
      )}

      <div className="gallery-page__content">
        {!isInitialLoading && (
          <div className="gallery-page__search-filter-sticky">
            <GallerySearchBar />
          </div>
        )}

        {isInitialLoading ? (
          <LoadingSpinner message="Загрузка стикеров..." />
        ) : error ? (
          <ErrorDisplay error={error} onRetry={() => fetchStickerSets()} />
        ) : galleryPacks.length === 0 ? (
          <EmptyState
            title="🎨 Стикеры не найдены"
            message={
              selectedCategories.length > 0 
                ? `Нет стикеров с выбранными категориями.`
                : searchTerm 
                  ? 'По вашему запросу ничего не найдено' 
                  : 'У вас пока нет созданных наборов стикеров'
            }
          />
        ) : (
          <div className="fade-in">
            <OptimizedGallery
              packs={galleryPacks}
              onPackClick={handleViewStickerSet}
              hasNextPage={currentPage < totalPages - 1}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMoreStickerSets}
              scrollElement={scrollElement}
            />
            {currentPage < totalPages - 1 && (
              <div className="gallery-page__see-more">See more</div>
            )}
          </div>
        )}
      </div>

      <StickerPackModal 
        open={isDetailOpen} 
        stickerSet={selectedStickerSet} 
        onClose={handleBackToList}
        onLike={(id, title) => {
          console.log(`Лайк для стикерсета ${id}: ${title}`);
        }}
      />
    </div>
  );
};

export const GalleryPage2: React.FC = () => {
  return <GalleryPage2Content />;
};
