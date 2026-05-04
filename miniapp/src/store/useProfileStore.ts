import { create } from 'zustand';
import { StickerSetResponse } from '@/types/sticker';
import type { UserInfo } from '@/types/user';
import { apiClient } from '@/api/client';

// Тип для кэшированного профиля
interface CachedProfile {
  userInfo: UserInfo;
  stickerSets: StickerSetResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalElements: number;
  };
  timestamp: number;
}

interface ProfileState {
  // Кэш профилей (userId -> данные профиля)
  profileCache: Map<number, CachedProfile>;
  cacheTTL: number; // Time to live в миллисекундах (по умолчанию 5 минут)
  // Состояние загрузки
  isLoading: boolean;
  isUserLoading: boolean;
  isStickerSetsLoading: boolean;
  isMyProfileLoading: boolean;
  hasMyProfileLoaded: boolean;
  /** true только когда профиль получен через /profiles/me (успешная авторизация). false при fallback/mock. */
  isProfileFromAuthenticatedApi: boolean;

  // Данные
  userInfo: UserInfo | null;
  userStickerSets: StickerSetResponse[];
  currentPage: number;
  totalPages: number;
  totalElements: number;
  currentUserId: number | null;
  currentUserRole: string | null;
  
  // Ошибки
  error: string | null;
  userError: string | null;
  stickerSetsError: string | null;
  
  // Действия для загрузки
  setLoading: (loading: boolean) => void;
  setUserLoading: (loading: boolean) => void;
  setStickerSetsLoading: (loading: boolean) => void;
  
  // Действия для пользователя
  setUserInfo: (user: UserInfo | null) => void;
  clearUserInfo: () => void;
  
  // Действия для стикерсетов
  setUserStickerSets: (stickerSets: StickerSetResponse[]) => void;
  addUserStickerSets: (stickerSets: StickerSetResponse[]) => void;
  removeUserStickerSet: (id: number) => void;
  updateUserStickerSet: (id: number, updates: Partial<StickerSetResponse>) => void;
  
  // Оптимистичные обновления статуса стикерсетов пользователя
  markUserStickerAsBlocked: (id: number, reason?: string) => void;
  markUserStickerAsUnblocked: (id: number) => void;
  markUserStickerAsDeleted: (id: number) => void;
  markUserStickerAsPublished: (id: number) => void;
  markUserStickerAsUnpublished: (id: number) => void;
  
  // Действия для ошибок
  setError: (error: string | null) => void;
  setUserError: (error: string | null) => void;
  setStickerSetsError: (error: string | null) => void;
  clearErrors: () => void;
  
  // Действия для пагинации
  setPagination: (page: number, totalPages: number, totalElements: number) => void;
  
  // Действия для кэша
  getCachedProfile: (userId: number) => CachedProfile | null;
  setCachedProfile: (userId: number, userInfo: UserInfo, stickerSets: StickerSetResponse[], pagination: { currentPage: number; totalPages: number; totalElements: number }) => void;
  isCacheValid: (userId: number) => boolean;
  clearCache: (userId?: number) => void;
  
  // Сброс состояния
  reset: () => void;

  // Инициализация текущего пользователя
  initializeCurrentUser: (fallbackUserId?: number | null) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  // Начальное состояние
  profileCache: new Map<number, CachedProfile>(),
  cacheTTL: 5 * 60 * 1000, // 5 минут
  isLoading: false,
  isUserLoading: false,
  isStickerSetsLoading: false,
  isMyProfileLoading: false,
  hasMyProfileLoaded: false,
  isProfileFromAuthenticatedApi: false,
  userInfo: null,
  userStickerSets: [],
  currentPage: 0,
  totalPages: 0,
  totalElements: 0,
  error: null,
  userError: null,
  stickerSetsError: null,
  currentUserId: null,
  currentUserRole: null,

  // Действия для загрузки
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setUserLoading: (loading: boolean) => set({ isUserLoading: loading }),
  setStickerSetsLoading: (loading: boolean) => set({ isStickerSetsLoading: loading }),
  
  // Действия для пользователя
  setUserInfo: (userInfo: UserInfo | null) =>
    set((state) => ({
      userInfo,
      currentUserId: userInfo?.telegramId ?? userInfo?.id ?? state.currentUserId,
      currentUserRole: userInfo?.role ?? state.currentUserRole,
    })),
  clearUserInfo: () => set({ userInfo: null, isProfileFromAuthenticatedApi: false }),
  
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

  updateUserStickerSet: (id: number, updates: Partial<StickerSetResponse>) => {
    const { userStickerSets } = get();
    if (!userStickerSets || userStickerSets.length === 0) {
      return;
    }
    const updatedStickerSets = userStickerSets.map((stickerSet) =>
      stickerSet.id === id ? { ...stickerSet, ...updates } : stickerSet
    );
    set({ userStickerSets: updatedStickerSets });
  },
  
  // Оптимистичные обновления статуса стикерсетов пользователя
  markUserStickerAsBlocked: (id: number, reason?: string) => {
    const { updateUserStickerSet } = get();
    updateUserStickerSet(id, { 
      isBlocked: true, 
      blockReason: reason || null,
      blockedAt: new Date().toISOString()
    });
  },
  
  markUserStickerAsUnblocked: (id: number) => {
    const { updateUserStickerSet } = get();
    updateUserStickerSet(id, { 
      isBlocked: false, 
      blockReason: null,
      blockedAt: null
    });
  },
  
  markUserStickerAsDeleted: (id: number) => {
    const { updateUserStickerSet } = get();
    // Для удаленных стикерсетов используем специальный флаг (не из API, локальный)
    updateUserStickerSet(id, { 
      isBlocked: true, // Удаленные также помечаются как заблокированные
      visibility: 'HIDDEN' as any
    });
  },
  
  markUserStickerAsPublished: (id: number) => {
    const { updateUserStickerSet } = get();
    updateUserStickerSet(id, { 
      isPublished: true,
      isPrivate: false,
      visibility: 'PUBLIC'
    });
  },
  
  markUserStickerAsUnpublished: (id: number) => {
    const { updateUserStickerSet } = get();
    updateUserStickerSet(id, { 
      isPublished: false,
      isPrivate: true,
      visibility: 'PRIVATE'
    });
  },
  
  // Действия для ошибок
  setError: (error: string | null) => set({ error }),
  setUserError: (userError: string | null) => set({ userError }),
  setStickerSetsError: (stickerSetsError: string | null) => set({ stickerSetsError }),
  clearErrors: () => set({ error: null, userError: null, stickerSetsError: null }),
  
  // Действия для пагинации
  setPagination: (page: number, totalPages: number, totalElements: number) => 
    set({ currentPage: page, totalPages, totalElements }),
  
  // Действия для кэша
  getCachedProfile: (userId: number) => {
    const { profileCache } = get();
    return profileCache.get(userId) || null;
  },
  
  setCachedProfile: (userId: number, userInfo: UserInfo, stickerSets: StickerSetResponse[], pagination: { currentPage: number; totalPages: number; totalElements: number }) => {
    const { profileCache } = get();
    const newCache = new Map(profileCache);
    newCache.set(userId, {
      userInfo,
      stickerSets,
      pagination,
      timestamp: Date.now()
    });
    set({ profileCache: newCache });
    console.log(`💾 Профиль пользователя ${userId} сохранен в кэш`);
  },
  
  isCacheValid: (userId: number) => {
    const { profileCache, cacheTTL } = get();
    const cached = profileCache.get(userId);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp;
    const isValid = age < cacheTTL;
    
    if (!isValid) {
      console.log(`⏰ Кэш профиля ${userId} устарел (${Math.round(age / 1000)}с)`);
    } else {
      console.log(`✅ Кэш профиля ${userId} актуален (${Math.round(age / 1000)}с)`);
    }
    
    return isValid;
  },
  
  clearCache: (userId?: number) => {
    const { profileCache } = get();
    if (userId !== undefined) {
      const newCache = new Map(profileCache);
      newCache.delete(userId);
      set({ profileCache: newCache });
      console.log(`🧹 Кэш профиля ${userId} очищен`);
    } else {
      set({ profileCache: new Map() });
      console.log('🧹 Весь кэш профилей очищен');
    }
  },
  
  // Сброс состояния
  reset: () => set({
    isLoading: false,
    isUserLoading: false,
    isStickerSetsLoading: false,
    isMyProfileLoading: false,
    hasMyProfileLoaded: false,
    isProfileFromAuthenticatedApi: false,
    userInfo: null,
    userStickerSets: [],
    currentPage: 0,
    totalPages: 0,
    totalElements: 0,
    error: null,
    userError: null,
    stickerSetsError: null,
    currentUserId: null,
    currentUserRole: null,
  }),

  initializeCurrentUser: async (fallbackUserId?: number | null) => {
    const {
      isMyProfileLoading,
      hasMyProfileLoaded,
      currentUserId,
      currentUserRole,
      userInfo,
    } = get();

    if (isMyProfileLoading || hasMyProfileLoaded) {
      return;
    }

    set({ isMyProfileLoading: true, userError: null });

    const candidateIds: Array<number | null | undefined> = [
      currentUserId,
      userInfo?.telegramId,
      userInfo?.id,
      fallbackUserId,
    ];

    const resolveCandidateId = (...extra: Array<number | null | undefined>) => {
      const all = [...extra, ...candidateIds];
      const valid = all.find((value) => typeof value === 'number' && !Number.isNaN(value));
      return typeof valid === 'number' ? valid : null;
    };

    const mergeProfileWithPhoto = (
      profile: UserInfo,
      photo: { profilePhotoFileId?: string; profilePhotos?: any } | null
    ): UserInfo => {
      if (photo?.profilePhotoFileId || photo?.profilePhotos) {
        return { ...profile, profilePhotoFileId: photo.profilePhotoFileId, profilePhotos: photo.profilePhotos };
      }
      return profile;
    };

    try {
      const me = await apiClient.getMyProfile();

      if (!me) {
        const fallbackId = resolveCandidateId();
        if (fallbackId !== null) {
          try {
            const [profile, photo] = await Promise.all([
              apiClient.getProfile(fallbackId),
              apiClient.getUserPhoto(fallbackId).catch(() => null),
            ]);
            const userInfoWithPhoto = mergeProfileWithPhoto(profile, photo);
            set({
              userInfo: userInfoWithPhoto,
              currentUserId: userInfoWithPhoto.telegramId ?? userInfoWithPhoto.id ?? fallbackId,
              currentUserRole: userInfoWithPhoto.role ?? currentUserRole ?? null,
              isProfileFromAuthenticatedApi: false,
            });
          } catch (profileError) {
            console.warn('Не удалось загрузить профиль пользователя (fallback):', profileError);
          }
        }
      } else {
        const meId = me.userId ?? me.id;
        const nextUserId = resolveCandidateId(meId);
        const nextRole = me.role ?? currentUserRole ?? null;

        set({
          currentUserId: nextUserId,
          currentUserRole: nextRole,
          isProfileFromAuthenticatedApi: true,
        });

        const needsFullProfile =
          !userInfo ||
          typeof userInfo.id !== 'number' ||
          (typeof meId === 'number' && userInfo.id !== meId);

        if (needsFullProfile && typeof meId === 'number') {
          try {
            const [profile, photo] = await Promise.all([
              apiClient.getProfile(meId),
              apiClient.getUserPhoto(meId).catch(() => null),
            ]);
            const userInfoWithPhoto = mergeProfileWithPhoto(profile, photo);
            set({
              userInfo: userInfoWithPhoto,
              currentUserId: userInfoWithPhoto.telegramId ?? userInfoWithPhoto.id ?? nextUserId,
              currentUserRole: userInfoWithPhoto.role ?? nextRole ?? null,
              isProfileFromAuthenticatedApi: true,
            });
          } catch (profileError) {
            console.warn('Не удалось загрузить полный профиль пользователя:', profileError);
          }
        } else if (typeof meId === 'number') {
          try {
            const photo = await apiClient.getUserPhoto(me.id).catch(() => null);
            const userInfoWithPhoto = mergeProfileWithPhoto(me, photo);
            set({ userInfo: userInfoWithPhoto, isProfileFromAuthenticatedApi: true });
          } catch {
            set({ userInfo: me, isProfileFromAuthenticatedApi: true });
          }
        }
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Не удалось загрузить профиль пользователя';
      set({ userError: message });
      const fallbackId = resolveCandidateId(fallbackUserId);
      if (fallbackId !== null) {
        try {
          const [profile, photo] = await Promise.all([
            apiClient.getProfile(fallbackId),
            apiClient.getUserPhoto(fallbackId).catch(() => null),
          ]);
          const userInfoWithPhoto = mergeProfileWithPhoto(profile, photo);
          set({
            userInfo: userInfoWithPhoto,
            currentUserId: userInfoWithPhoto.telegramId ?? userInfoWithPhoto.id ?? fallbackId,
            currentUserRole: userInfoWithPhoto.role ?? currentUserRole ?? null,
            isProfileFromAuthenticatedApi: false,
          });
        } catch (profileError) {
          console.warn('Не удалось загрузить профиль пользователя после ошибки:', profileError);
        }
      }
    } finally {
      set({
        isMyProfileLoading: false,
        hasMyProfileLoaded: true,
      });
    }
  },
}));
