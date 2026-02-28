import { AddIcon } from '@/components/ui/Icons';
import { useEffect, useState, useCallback, useMemo, useRef, FC } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useScrollElement } from '../contexts/ScrollContext';
import { useStickerStore } from '../store/useStickerStore';
import { useLikesStore } from '../store/useLikesStore';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../api/client';
import { StickerSetResponse } from '../types/sticker';

// Components
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { EmptyState } from '../components/EmptyState';
import { StickerPackModal } from '../components/StickerPackModal';
import { SearchBar } from '../components/SearchBar';
import { OptimizedGallery } from '../components/OptimizedGallery';
import { adaptStickerSetsToGalleryPacks } from '../utils/galleryAdapter';
import { Category } from '../components/CategoryFilter';
import { UploadStickerPackModal } from '../components/UploadStickerPackModal';
import { StixlyPageContainer } from '../components/layout/StixlyPageContainer';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import './GalleryNewPage.css';

const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const GalleryNewPage: FC = () => {
  const { tg, user, initData, isInTelegramApp } = useTelegram();
  const scrollElement = useScrollElement();
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
  const syncPendingLikes = useLikesStore(state => state.syncPendingLikes);
  
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Refs for tracking filters and initialization
  const hasInitializedRef = useRef(false);
  const lastFiltersRef = useRef<{ categories: string[], searchTerm: string }>({
    categories: [],
    searchTerm: ''
  });

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const apiCategories = await apiClient.getCategories();
      const uiCategories = apiCategories.map(cat => ({
        id: cat.key,
        label: cat.name,
        title: cat.description
      }));
      setCategories(uiCategories);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // Fetch sticker sets
  const fetchStickerSets = useCallback(async (
    page: number = 0, 
    isLoadMore: boolean = false,
    filterCategories?: string[]
  ) => {
    // Защита от повторных вызовов
    if (isLoadMore && isLoadingMore) {
      console.warn('⚠️ Загрузка уже выполняется, пропускаем');
      return;
    }
    
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Неблокирующая авторизация
      if (initData) {
        checkAuth(initData).catch(error => {
          console.warn('⚠️ Фоновая авторизация не удалась, но продолжаем работу:', error);
        });
      }

      // Опции для API запроса
      const apiOptions = {
        categoryKeys: filterCategories && filterCategories.length > 0 ? filterCategories : undefined,
        sort: 'id',
        direction: 'DESC' as const,
        preview: true
      };

      // Определяем, нужно ли использовать поиск или обычный запрос
      const searchQuery = lastFiltersRef.current.searchTerm.trim();
      let response;

      if (searchQuery) {
        // Используем поиск
        console.log('🔍 Выполняем поиск стикерсетов с query:', searchQuery);
        response = await apiClient.searchStickerSets(searchQuery, page, 20, apiOptions);
      } else {
        // Обычная загрузка без поиска
        response = await apiClient.getStickerSets(page, 20, apiOptions);
      }
      
      if (isLoadMore) {
        // Добавляем новые стикерсеты к существующим
        addStickerSets(response.content || []);
      } else {
        // Заменяем все стикерсеты
        setStickerSets(response.content || []);
      }
      
      // Инициализируем лайки из API данных
      if (response.content && response.content.length > 0) {
        initializeLikes(response.content, isLoadMore);
      }
      
      // Обновляем информацию о пагинации
      setPagination(
        response.number ?? 0,
        response.totalPages ?? 0,
        response.totalElements ?? 0
      );
    } catch (err: any) {
      console.error('Failed to fetch sticker sets:', err);
      setError(err.message || 'Failed to load sticker sets');
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [isLoadingMore, checkAuth, setLoading, setStickerSets, addStickerSets, setPagination, setError, initializeLikes]);

  // Initialization - only on first mount
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      lastFiltersRef.current = {
        categories: [...selectedCategories],
        searchTerm: ''
      };
      fetchCategories();
      fetchStickerSets(0, false, selectedCategories);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when categories change (after initialization)
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    
    // Check if categories actually changed
    const categoriesChanged = JSON.stringify(selectedCategories) !== JSON.stringify(lastFiltersRef.current.categories);
    
    if (categoriesChanged) {
      lastFiltersRef.current = {
        categories: [...selectedCategories],
        searchTerm: lastFiltersRef.current.searchTerm // Preserve search term
      };
      fetchStickerSets(0, false, selectedCategories);
    }
  }, [selectedCategories, fetchStickerSets]);

  // Initialize likes
  useEffect(() => {
    if (user?.id && stickerSets.length > 0) {
      const stickerSetObjs = stickerSets.map(set => ({ id: set.id, likes: set.likesCount })).filter(obj => obj.id != null);
      if (stickerSetObjs.length > 0) {
        initializeLikes(stickerSetObjs);
      }
    }
  }, [user?.id, stickerSets, initializeLikes]);

  // Sync pending likes
  useEffect(() => {
    if (user?.id && initData) {
      syncPendingLikes();
    }
  }, [user?.id, initData, syncPendingLikes]);

  // Handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSearch = useCallback((value: string) => {
    // Update searchTerm and perform search explicitly
    setSearchTerm(value);
    // Update ref for tracking changes
    lastFiltersRef.current = {
      ...lastFiltersRef.current,
      searchTerm: value
    };
    // Perform search
    fetchStickerSets(0, false, selectedCategories);
  }, [fetchStickerSets, selectedCategories]);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategories(prev => {
      const isSelected = prev.includes(categoryId);
      return isSelected
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId];
    });
  }, []);

  const handleViewStickerSet = useCallback((packId: string) => {
    const stickerSet = stickerSets.find(set => set.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsDetailOpen(true);
    }
  }, [stickerSets]);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedStickerSet(null);
  }, []);

  const handleAddClick = useCallback(() => {
    tg?.HapticFeedback?.impactOccurred('light');
    setIsUploadModalOpen(true);
  }, [tg]);

  const loadMoreStickerSets = useCallback(() => {
    if (currentPage >= totalPages - 1 || isLoadingMore) {
      return;
    }
    fetchStickerSets(currentPage + 1, true, selectedCategories);
  }, [currentPage, totalPages, isLoadingMore, selectedCategories, fetchStickerSets]);

  // Adapt to gallery packs (no local filtering - API does it)
  const galleryPacks = useMemo(() => 
    adaptStickerSetsToGalleryPacks(stickerSets),
    [stickerSets]
  );

  const isInitialLoading = isLoading && stickerSets.length === 0 && !error;

  return (
    <div className={cn('page-container', isInTelegramApp && 'telegram-app')}>
      <OtherAccountBackground />
      {/* Верхняя панель — эталонное стекло с оттенком заливки */}
      <div className="gallery-page__top-panel">
        <div className="gallery-page__banner">
          <div className="gallery-page__banner-title">🎨 Галерея Стикеров</div>
          <p className="gallery-page__banner-subtitle">Найдите и добавьте стикеры в Telegram</p>
        </div>

        <div className="gallery-page__search-row">
          <div>
            <SearchBar
              value={searchTerm}
              onChange={handleSearchChange}
              onSearch={handleSearch}
              placeholder="Поиск стикеров..."
              disabled={false}
              compact={true}
            />
          </div>
          <button
            type="button"
            className="gallery-page__add-btn"
            onClick={handleAddClick}
            aria-label="Добавить стикерпак"
          >
            <AddIcon style={{ fontSize: '1rem' }} />
            <span>Добавить</span>
          </button>
        </div>

        {categories.length > 0 && (
          <div className="gallery-page__categories-wrap">
            <div className="gallery-page__categories">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    'gallery-page__category-chip',
                    selectedCategories.includes(category.id) && 'gallery-page__category-chip--selected'
                  )}
                  onClick={() => {
                    tg?.HapticFeedback?.impactOccurred('light');
                    handleCategoryToggle(category.id);
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content with top padding */}
      <div style={{ paddingTop: '180px' }}>
        <StixlyPageContainer>
          {isInitialLoading ? (
            <LoadingSpinner message="Загрузка стикеров..." />
          ) : error ? (
            <ErrorDisplay error={error} onRetry={() => fetchStickerSets()} />
          ) : stickerSets.length === 0 ? (
            <EmptyState
              title="🎨 Стикеры не найдены"
              message={
                selectedCategories.length > 0 
                  ? 'Нет стикеров с выбранными категориями'
                  : searchTerm 
                    ? 'По вашему запросу ничего не найдено' 
                    : 'У вас пока нет созданных наборов стикеров'
              }
            />
          ) : (
            <OptimizedGallery
              packs={galleryPacks}
              onPackClick={handleViewStickerSet}
              hasNextPage={currentPage < totalPages - 1}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMoreStickerSets}
              scrollElement={scrollElement}
            />
          )}
        </StixlyPageContainer>
      </div>

      {/* Modals */}
      {selectedStickerSet && (
        <StickerPackModal
          stickerSet={selectedStickerSet}
          open={isDetailOpen}
          onClose={handleCloseDetail}
        />
      )}

      <UploadStickerPackModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onComplete={() => {
          setIsUploadModalOpen(false);
          fetchStickerSets(0);
        }}
      />
    </div>
  );
};

