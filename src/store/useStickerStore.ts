import { create } from 'zustand';
import { StickerSetResponse, AuthResponse } from '@/types/sticker';

interface StickerState {
  // Состояние загрузки
  isLoading: boolean;
  isAuthLoading: boolean;
  
  // Данные
  stickerSets: StickerSetResponse[];
  authStatus: AuthResponse | null;
  currentPage: number;
  totalPages: number;
  totalElements: number;
  
  // UI состояние
  searchTerm: string;
  selectedCategories: string[];
  viewMode: 'list' | 'detail';
  selectedStickerSet: StickerSetResponse | null;
  
  // Ошибки
  error: string | null;
  authError: string | null;
  
  // Действия для загрузки
  setLoading: (loading: boolean) => void;
  setAuthLoading: (loading: boolean) => void;
  
  // Действия для данных
  setStickerSets: (stickerSets: StickerSetResponse[]) => void;
  addStickerSets: (stickerSets: StickerSetResponse[]) => void; // Для пагинации
  updateStickerSet: (id: number, stickerSet: Partial<StickerSetResponse>) => void;
  removeStickerSet: (id: number) => void;
  
  // Действия для авторизации
  setAuthStatus: (authStatus: AuthResponse) => void;
  
  // Действия для UI состояния
  setSearchTerm: (searchTerm: string) => void;
  setSelectedCategories: (categories: string[]) => void;
  setViewMode: (viewMode: 'list' | 'detail') => void;
  setSelectedStickerSet: (stickerSet: StickerSetResponse | null) => void;
  
  // Действия для ошибок
  setError: (error: string | null) => void;
  setAuthError: (error: string | null) => void;
  clearErrors: () => void;
  
  // Действия для пагинации
  setPagination: (page: number, totalPages: number, totalElements: number) => void;
  
  // Методы API
  fetchStickerSets: (page?: number, size?: number) => Promise<void>;
  searchStickerSets: (query: string, page?: number, size?: number) => Promise<void>;
}

export const useStickerStore = create<StickerState>((set, get) => ({
  // Начальное состояние
  isLoading: false,
  isAuthLoading: false,
  stickerSets: [],
  authStatus: null,
  currentPage: 0,
  totalPages: 0,
  totalElements: 0,
  error: null,
  authError: null,
  
  // UI состояние
  searchTerm: '',
  selectedCategories: [],
  viewMode: 'list',
  selectedStickerSet: null,

  // Действия для загрузки
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setAuthLoading: (loading: boolean) => set({ isAuthLoading: loading }),
  
  // Действия для данных
  setStickerSets: (stickerSets: StickerSetResponse[]) => set({ stickerSets }),
  
  addStickerSets: (newStickerSets: StickerSetResponse[]) => {
    const { stickerSets } = get();
    // Добавляем новые стикерсеты, избегая дубликатов
    const existingIds = new Set(stickerSets.map(s => s.id));
    const uniqueNewSets = newStickerSets.filter(s => !existingIds.has(s.id));
    set({ stickerSets: [...stickerSets, ...uniqueNewSets] });
  },
  
  updateStickerSet: (id: number, updates: Partial<StickerSetResponse>) => {
    const { stickerSets } = get();
    const updatedStickerSets = stickerSets.map(stickerSet => 
      stickerSet.id === id ? { ...stickerSet, ...updates } : stickerSet
    );
    set({ stickerSets: updatedStickerSets });
  },
  
  removeStickerSet: (id: number) => {
    const { stickerSets } = get();
    const updatedStickerSets = stickerSets.filter(stickerSet => stickerSet.id !== id);
    set({ stickerSets: updatedStickerSets });
  },
  
  // Действия для авторизации
  setAuthStatus: (authStatus: AuthResponse) => set({ authStatus }),
  
  // Действия для UI состояния
  setSearchTerm: (searchTerm: string) => set({ searchTerm }),
  setSelectedCategories: (selectedCategories: string[]) => set({ selectedCategories }),
  setViewMode: (viewMode: 'list' | 'detail') => set({ viewMode }),
  setSelectedStickerSet: (selectedStickerSet: StickerSetResponse | null) => set({ selectedStickerSet }),
  
  // Действия для ошибок
  setError: (error: string | null) => set({ error }),
  setAuthError: (authError: string | null) => set({ authError }),
  clearErrors: () => set({ error: null, authError: null }),
  
  // Действия для пагинации
  setPagination: (page: number, totalPages: number, totalElements: number) => 
    set({ currentPage: page, totalPages, totalElements }),
  
  // Методы API - временная заглушка, будут реализованы позже
  fetchStickerSets: async (page = 0, size = 20) => {
    // Эта функция будет вызываться из компонентов
    // Логика будет в компонентах для избежания циклических зависимостей
  },
  
  searchStickerSets: async (query: string, page = 0, size = 20) => {
    // Эта функция будет вызываться из компонентов
    // Логика будет в компонентах для избежания циклических зависимостей
  },
}));
