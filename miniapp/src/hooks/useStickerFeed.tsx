import { useState, useCallback, useMemo, ReactNode } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { SortButton } from '@/components/SortButton';

export interface StickerFeedConfig {
  // Текущая страница и общее количество страниц
  currentPage: number;
  totalPages: number;
  
  // Состояния загрузки
  isLoading: boolean;
  isLoadingMore?: boolean;
  
  // Функция загрузки следующей страницы
  onLoadMore: () => void;
  
  // Функция поиска (опционально, если не указана, используется onRefresh)
  onSearch?: (query: string) => void;
  
  // Функция обновления при изменении сортировки
  onSortChange?: (sortByLikes: boolean) => void;
  
  // Начальное значение сортировки
  initialSortByLikes?: boolean;
  
  // Отключить поиск или сортировку
  disableSearch?: boolean;
  disableSort?: boolean;
  
  // Плейсхолдер для поиска
  searchPlaceholder?: string;
  
  // Дополнительные условия для отключения сортировки
  disableSortCondition?: boolean;
}

export interface StickerFeedControls {
  // Элемент управления для отображения над галереей (поиск, фильтры)
  controlsElement: ReactNode;
  
  // Состояния
  searchTerm: string;
  sortByLikes: boolean;
  
  // Обработчики
  handleSearchChange: (term: string) => void;
  handleSearch: (term: string) => void;
  handleSortToggle: () => void;
  
  // Флаги для пагинации
  hasNextPage: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
}

/**
 * Хук для унификации управления лентой стикеров
 * Предоставляет общую логику поиска, сортировки и пагинации
 */
export const useStickerFeed = (config: StickerFeedConfig): StickerFeedControls => {
  const {
    currentPage,
    totalPages,
    isLoading,
    isLoadingMore = false,
    onSearch,
    onSortChange,
    initialSortByLikes = false,
    disableSearch = false,
    disableSort = false,
    searchPlaceholder = 'Поиск стикеров...',
    disableSortCondition = false,
  } = config;

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByLikes, setSortByLikes] = useState(initialSortByLikes);

  // Обработчик изменения поискового запроса
  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  }, []);

  // Обработчик поиска
  const handleSearch = useCallback((term: string) => {
    if (onSearch) {
      onSearch(term);
    }
  }, [onSearch]);

  // Обработчик переключения сортировки
  const handleSortToggle = useCallback(() => {
    const newSortByLikes = !sortByLikes;
    setSortByLikes(newSortByLikes);
    if (onSortChange) {
      onSortChange(newSortByLikes);
    }
  }, [sortByLikes, onSortChange]);

  // Вычисляем, есть ли следующая страница
  const hasNextPage = useMemo(() => {
    return currentPage < totalPages - 1;
  }, [currentPage, totalPages]);

  // Вычисляем, идет ли обновление (загрузка при наличии данных)
  const isRefreshing = useMemo(() => {
    return isLoading && !isLoadingMore;
  }, [isLoading, isLoadingMore]);

  // Создаем элемент управления
  const controlsElement = useMemo(() => {
    if (disableSearch && disableSort) {
      return null;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.618rem', width: '100%', marginTop: '0.75rem' }}>
        {!disableSearch && (
          <div style={{ flex: 1 }}>
            <SearchBar
              value={searchTerm}
              onChange={handleSearchChange}
              onSearch={handleSearch}
              placeholder={searchPlaceholder}
              disabled={isLoading}
            />
          </div>
        )}
        {!disableSort && (
          <SortButton
            sortByLikes={sortByLikes}
            onToggle={handleSortToggle}
            disabled={isLoading || disableSortCondition || !!searchTerm}
          />
        )}
      </div>
    );
  }, [
    disableSearch,
    disableSort,
    searchTerm,
    sortByLikes,
    handleSearchChange,
    handleSearch,
    handleSortToggle,
    isLoading,
    disableSortCondition,
    searchPlaceholder,
  ]);

  return {
    controlsElement,
    searchTerm,
    sortByLikes,
    handleSearchChange,
    handleSearch,
    handleSortToggle,
    hasNextPage,
    isLoadingMore,
    isRefreshing,
  };
};

