import { create } from 'zustand';
import { StickerSetResponse } from '@/types/sticker';

// Тип для Telegram пользователя
export interface TelegramUserData {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

// Тип для информации о пользователе из Telegram
export interface TelegramUserInfo {
  user: TelegramUserData;
  status: string;
}

// Тип для информации о пользователе
export interface UserInfo {
  id: number;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string;
  artBalance: number;
  createdAt: string;
  updatedAt?: string;
  profilePhotoFileId?: string; // file_id фото профиля для загрузки через /api/proxy/stickers/{fileId}
  telegramUserInfo?: TelegramUserInfo; // Дополнительная информация о пользователе из Telegram (приоритетный источник данных)
  profilePhotos?: any; // Коллекция фотографий профиля
}

interface ProfileState {
  // Состояние загрузки
  isLoading: boolean;
  isUserLoading: boolean;
  isStickerSetsLoading: boolean;
  
  // Данные
  userInfo: UserInfo | null;
  userStickerSets: StickerSetResponse[];
  currentPage: number;
  totalPages: number;
  totalElements: number;
  
  // Ошибки
  error: string | null;
  userError: string | null;
  stickerSetsError: string | null;
  
  // Действия для загрузки
  setLoading: (loading: boolean) => void;
  setUserLoading: (loading: boolean) => void;
  setStickerSetsLoading: (loading: boolean) => void;
  
  // Действия для пользователя
  setUserInfo: (user: UserInfo) => void;
  clearUserInfo: () => void;
  
  // Действия для стикерсетов
  setUserStickerSets: (stickerSets: StickerSetResponse[]) => void;
  addUserStickerSets: (stickerSets: StickerSetResponse[]) => void;
  removeUserStickerSet: (id: number) => void;
  
  // Действия для ошибок
  setError: (error: string | null) => void;
  setUserError: (error: string | null) => void;
  setStickerSetsError: (error: string | null) => void;
  clearErrors: () => void;
  
  // Действия для пагинации
  setPagination: (page: number, totalPages: number, totalElements: number) => void;
  
  // Сброс состояния
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  // Начальное состояние
  isLoading: false,
  isUserLoading: false,
  isStickerSetsLoading: false,
  userInfo: null,
  userStickerSets: [],
  currentPage: 0,
  totalPages: 0,
  totalElements: 0,
  error: null,
  userError: null,
  stickerSetsError: null,

  // Действия для загрузки
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setUserLoading: (loading: boolean) => set({ isUserLoading: loading }),
  setStickerSetsLoading: (loading: boolean) => set({ isStickerSetsLoading: loading }),
  
  // Действия для пользователя
  setUserInfo: (userInfo: UserInfo) => set({ userInfo }),
  clearUserInfo: () => set({ userInfo: null }),
  
  // Действия для стикерсетов
  setUserStickerSets: (userStickerSets: StickerSetResponse[]) => set({ userStickerSets }),
  
  addUserStickerSets: (newStickerSets: StickerSetResponse[]) => {
    const { userStickerSets } = get();
    // Добавляем новые стикерсеты, избегая дубликатов
    const existingIds = new Set(userStickerSets.map(s => s.id));
    const uniqueNewSets = newStickerSets.filter(s => !existingIds.has(s.id));
    set({ userStickerSets: [...userStickerSets, ...uniqueNewSets] });
  },
  
  removeUserStickerSet: (id: number) => {
    const { userStickerSets } = get();
    const updatedStickerSets = userStickerSets.filter(stickerSet => stickerSet.id !== id);
    set({ userStickerSets: updatedStickerSets });
  },
  
  // Действия для ошибок
  setError: (error: string | null) => set({ error }),
  setUserError: (userError: string | null) => set({ userError }),
  setStickerSetsError: (stickerSetsError: string | null) => set({ stickerSetsError }),
  clearErrors: () => set({ error: null, userError: null, stickerSetsError: null }),
  
  // Действия для пагинации
  setPagination: (page: number, totalPages: number, totalElements: number) => 
    set({ currentPage: page, totalPages, totalElements }),
  
  // Сброс состояния
  reset: () => set({
    isLoading: false,
    isUserLoading: false,
    isStickerSetsLoading: false,
    userInfo: null,
    userStickerSets: [],
    currentPage: 0,
    totalPages: 0,
    totalElements: 0,
    error: null,
    userError: null,
    stickerSetsError: null,
  }),
}));
