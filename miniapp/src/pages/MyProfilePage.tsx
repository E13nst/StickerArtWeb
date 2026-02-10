import { useEffect, useState, useCallback, useMemo, useRef, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useTelegram } from '@/hooks/useTelegram';
import { useWallet } from '@/hooks/useWallet';
import { useProfileStore } from '@/store/useProfileStore';
import { useLikesStore } from '@/store/useLikesStore';
import { apiClient } from '@/api/client';
import { StickerSetResponse } from '@/types/sticker';

// UI Компоненты
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

// Компоненты
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { StickerPackModal } from '@/components/StickerPackModal';
import { OptimizedGallery } from '@/components/OptimizedGallery';
import { DebugPanel } from '@/components/DebugPanel';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';
import { UploadStickerPackModal } from '@/components/UploadStickerPackModal';
import { AddStickerPackButton } from '@/components/AddStickerPackButton';
import { CompactControlsBar } from '@/components/CompactControlsBar';
import { QuestStixlyCard, DailyActivityBlock, GlobalActivityBlock } from '@/components/AccountActivityBlocks';
import { Category } from '@/components/CategoryFilter';
import { useScrollElement } from '@/contexts/ScrollContext';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import '@/styles/common.css';
import '@/styles/MyProfilePage.css';

// Утилита для объединения классов
const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const MyProfilePage: FC = () => {
  const navigate = useNavigate();
  const { tg, user, initData, isInTelegramApp } = useTelegram();
  const scrollElement = useScrollElement();
  
  // TON Connect: получение адреса кошелька (используется только для получения адреса при подключении)
  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  
  // Управление кошельком через хук (backend - единственный источник истины)
  const { wallet, loading: walletLoading, error: walletError, linkWallet, unlinkWallet } = useWallet();
  
  // Обработка успешного подключения через TON Connect
  // Привязка происходит только при явном действии пользователя (клик на TonConnectButton)
  useEffect(() => {
    // Привязываем кошелёк только если:
    // 1. tonAddress появился (пользователь подключил кошелёк через TON Connect)
    // 2. Кошелёк ещё не привязан на бэкенде (wallet === null) ИЛИ адрес отличается
    // 3. Не идёт процесс загрузки
    if (tonAddress && !walletLoading) {
      const shouldLink = !wallet || wallet.walletAddress !== tonAddress;
      
      if (shouldLink) {
        console.debug('[MyProfilePage] Автоматическая привязка кошелька после подключения через TON Connect', {
          tonAddress: tonAddress.slice(0, 6) + '...' + tonAddress.slice(-4),
          currentWallet: wallet?.walletAddress?.slice(0, 6) + '...' + wallet?.walletAddress?.slice(-4)
        });
        linkWallet(tonAddress).catch((err) => {
          console.error('[MyProfilePage] Ошибка автоматической привязки кошелька', err);
        });
      }
    }
  }, [tonAddress, wallet, walletLoading, linkWallet]);
  
  // Логирование состояния кошелька в dev режиме
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (tonAddress) {
        console.debug('[MyProfilePage] TON Connect: кошелёк подключен', {
          address: tonAddress.slice(0, 6) + '...' + tonAddress.slice(-4)
        });
      }
      if (wallet) {
        console.debug('[MyProfilePage] Backend: кошелёк привязан', {
          address: wallet.walletAddress?.slice(0, 6) + '...' + wallet.walletAddress?.slice(-4),
          type: wallet.walletType
        });
      }
    }
  }, [tonAddress, wallet]);

  const {
    isLoading,
    isUserLoading,
    isStickerSetsLoading,
    userInfo,
    userStickerSets,
    currentPage,
    totalPages,
    error,
    userError,
    stickerSetsError,
    setLoading,
    setUserLoading,
    setStickerSetsLoading,
    setUserInfo,
    setUserStickerSets,
    addUserStickerSets,
    setPagination,
    setUserError,
    setStickerSetsError,
    setCachedProfile,
    clearCache,
  } = useProfileStore();
  // ✅ FIX: Используем selector для предотвращения пересоздания функции на каждом рендере
  const initializeLikes = useLikesStore(state => state.initializeLikes);
  
  // Подписываемся на изменения лайков для перезагрузки списка "понравившиеся"
  const likedIdsHash = useLikesStore((state) => {
    return Object.entries(state.likes)
      .filter(([_, likeState]: [string, any]) => likeState.isLiked)
      .map(([id]) => id)
      .sort()
      .join(',');
  });

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStickerSet, setSelectedStickerSet] = useState<any>(null);
  const handleStickerSetUpdated = useCallback((updated: StickerSetResponse) => {
    setSelectedStickerSet(updated);
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [walletMenuAnchor, setWalletMenuAnchor] = useState<null | HTMLElement>(null);
  // Категории для фильтрации (не используются на странице профиля, но требуются для CompactControlsBar)
  const [categories] = useState<Category[]>([]);
  const [likedStickerSets, setLikedStickerSets] = useState<any[]>([]);
  // Флаг: был ли список загружен с сервера (для оптимизации - не загружаем повторно)
  const [isLikedListLoaded, setIsLikedListLoaded] = useState(false);
  // Сохраняем исходный список для защиты от удаления карточек до инициализации в store
  const [originalLikedSetIds, setOriginalLikedSetIds] = useState<Set<string>>(new Set());
  // Пагинация для понравившихся
  const [likedCurrentPage, setLikedCurrentPage] = useState(0);
  const [likedTotalPages, setLikedTotalPages] = useState(1);
  const [isLikedLoadingMore, setIsLikedLoadingMore] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState(0); // 0: Create, 1: Likes, 2: Upload (Figma ACCOUNT)
  // Верхний уровень: Stickers (0) — head-account-tabs-wrap; Art-points (1) — account-menu-content / account-quests-grid
  const [mainTab, setMainTab] = useState(0); // 0: Stickers, 1: Art-points
  const isLikesTab = activeProfileTab === 1;
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [sortByLikes, setSortByLikes] = useState(false);
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null);
  // Отдельное состояние для загрузки следующей страницы "Мои" (аналогично GalleryPage)
  const [isLoadingMorePublished, setIsLoadingMorePublished] = useState(false);
  
  // Определение темы для кнопки (как в AddStickerPackButton)
  const computeIsLightTheme = useCallback(() => {
    if (tg?.colorScheme === 'light') return true;
    if (tg?.colorScheme === 'dark') return false;
    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('tg-light-theme')) return true;
      if (document.documentElement.classList.contains('tg-dark-theme')) return false;
      const themeAttr = document.documentElement.getAttribute('data-theme');
      if (themeAttr === 'light') return true;
      if (themeAttr === 'dark') return false;
    }
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return true;
  }, [tg]);
  
  const [isLightTheme, setIsLightTheme] = useState<boolean>(computeIsLightTheme);
  
  useEffect(() => {
    setIsLightTheme(computeIsLightTheme());
    const handleThemeChange = () => setIsLightTheme(computeIsLightTheme());
    tg?.onEvent?.('themeChanged', handleThemeChange);
    const observer = typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
      ? new MutationObserver(handleThemeChange)
      : null;
    if (observer) {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    }
    let mediaQuery: MediaQueryList | undefined;
    const handleMediaQueryChange = (event: MediaQueryListEvent) => setIsLightTheme(event.matches);
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      mediaQuery.addEventListener('change', handleMediaQueryChange);
    }
    return () => {
      tg?.offEvent?.('themeChanged', handleThemeChange);
      observer?.disconnect();
      mediaQuery?.removeEventListener('change', handleMediaQueryChange);
    };
  }, [tg, computeIsLightTheme]);
  // ✅ FIX: Отслеживаем текущий загружаемый fileId для предотвращения дублирования
  const loadingAvatarFileIdRef = useRef<string | null>(null);
  // ✅ FIX: Флаг для предотвращения повторных вызовов loadMyProfile из-за React.StrictMode
  const isProfileLoadingRef = useRef(false);
  // Ref для измерения высоты элементов перед CompactControlsBar
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // ✅ REFACTORED: Больше не зависим от user.id из Telegram
  // currentUserId будет получен из /api/profiles/me
  const currentUserId = userInfo?.id;

  useEffect(() => {
    console.log('🔍 MyProfilePage: Текущий пользователь:', user);
    console.log('🔍 MyProfilePage: initData:', initData ? `${initData.length} chars` : 'empty');
    
    // ✅ FIX: Защита от повторных вызовов из-за React.StrictMode в dev режиме
    if (isProfileLoadingRef.current) {
      console.log('🔍 MyProfilePage: Загрузка профиля уже выполняется, пропускаем');
      return;
    }
    
    // ✅ УПРОЩЕНО: Удалена проверка кэша из useEffect
    // Проблема: если в кэше были старые моковые данные (ivan_ivanov),
    // они загружались и делался return, не вызывая loadMyProfile() для получения реальных данных
    // 
    // Теперь loadMyProfile() сам решает использовать кэш или нет

    // Настраиваем заголовки: initData либо заголовки расширения в dev
    console.log('🔄 MyProfilePage: useEffect инициализации', { initData: !!initData, userInfo: !!userInfo });
    if (initData) {
      console.log('🔐 Устанавливаем заголовки авторизации из initData');
      apiClient.setAuthHeaders(initData);
    } else {
      console.log('🔧 Проверяем заголовки расширения');
      apiClient.checkExtensionHeaders();
    }

    // Устанавливаем флаг загрузки
    isProfileLoadingRef.current = true;

    // ✅ REFACTORED: Загружаем профиль без параметров (используется /api/profiles/me)
    // Оборачиваем в async для перехвата ошибок
    (async () => {
      try {
        console.log('🚀 Начинаем загрузку профиля...');
        await loadMyProfile();
        console.log('✅ Загрузка профиля завершена');
      } catch (error) {
        // Ошибка уже обработана в loadMyProfile и установлена в userError
        console.error('❌ Ошибка при загрузке профиля перехвачена в useEffect:', error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ REFACTORED: Загрузка своего профиля через /api/profiles/me с кэшированием
  const loadMyProfile = async (forceReload: boolean = false) => {
    console.log('🔄 loadMyProfile вызван', { forceReload });
    
    // Проверяем кэш (по ключу 'me')
    if (!forceReload) {
      console.log('🔍 Проверяем кэш...');
      // Попытаемся получить из кэша любой профиль (обычно там только один)
      const cachedKeys = Object.keys(localStorage).filter(k => k.startsWith('profile_cache_'));
      if (cachedKeys.length > 0) {
        try {
          const cachedData = JSON.parse(localStorage.getItem(cachedKeys[0]) || '{}');
          
          // ✅ ВАЖНО: Проверяем что это НЕ моковые данные (Иван Иванов)
          if (cachedData.userInfo) {
            const isMockData = 
              cachedData.userInfo.firstName === 'Иван' || 
              cachedData.userInfo.username === 'ivan_ivanov' ||
              cachedData.userInfo.username === 'mockuser';
              
            if (isMockData) {
              console.log('🗑️ Обнаружены моковые данные в кэше, пропускаем и загружаем с сервера');
              // Очищаем моковые данные из кэша
              localStorage.removeItem(cachedKeys[0]);
            } else {
              console.log(`📦 Загрузка моего профиля из кэша`);
              const cachedUserInfo = {
                ...cachedData.userInfo,
                avatarUrl: cachedData.userInfo.avatarUrl || 
                           (cachedData.userInfo.profilePhotoFileId || cachedData.userInfo.profilePhotos 
                             ? undefined 
                             : user?.photo_url)
              };
              setUserInfo(cachedUserInfo);
              setUserStickerSets(cachedData.stickerSets || []);
              setPagination(
                cachedData.pagination?.currentPage || 0,
                cachedData.pagination?.totalPages || 1,
                cachedData.pagination?.totalElements || 0
              );
              
              // Загружаем фото как blob URL
              if (cachedUserInfo.profilePhotoFileId || cachedUserInfo.profilePhotos) {
                loadAvatarBlob(cachedUserInfo.id || cachedUserInfo.telegramId, cachedUserInfo.profilePhotoFileId, cachedUserInfo.profilePhotos);
              } else {
                setAvatarBlobUrl(null);
              }
              
              // Инициализируем лайки из кеша с mergeMode = true
              if (cachedData.stickerSets && cachedData.stickerSets.length > 0) {
                initializeLikes(cachedData.stickerSets, true);
              }
              return;
            }
          }
        } catch (e) {
          console.warn('Ошибка чтения кэша:', e);
        }
      }
    }
    
    // Загружаем с сервера
    console.log(`🌐 Загрузка моего профиля с сервера через /api/profiles/me`);
    setLoading(true);
    
    try {
      // Загружаем профиль пользователя
      const loadedProfile = await loadUserInfo();
      
      // Если не удалось загрузить профиль, выходим
      if (!loadedProfile?.id) {
        console.error('❌ Не удалось получить ID пользователя');
        // ✅ Используем setUserError чтобы показать ошибку в UI
        // (error не показывается, только userError)
        if (!userError) {
          setUserError('Не удалось загрузить профиль пользователя');
        }
        console.log('🔄 Ранний выход из loadMyProfile, isLoading будет сброшен в finally');
        return;
      }

      // Загружаем стикерсеты пользователя
      try {
        await loadUserStickerSets(loadedProfile.id, undefined, 0, false, sortByLikes);
      } catch (stickerError) {
        console.error('Ошибка загрузки стикерсетов:', stickerError);
        // Не показываем ошибку пользователю - профиль загружен, просто нет стикерсетов
      }

      const currentUserInfo = useProfileStore.getState().userInfo;
      const currentStickerSets = useProfileStore.getState().userStickerSets;
      const currentPagination = {
        currentPage: useProfileStore.getState().currentPage,
        totalPages: useProfileStore.getState().totalPages,
        totalElements: useProfileStore.getState().totalElements
      };
      
      // Кэшируем по userId который вернул сервер
      if (currentUserInfo && currentStickerSets && currentUserInfo.id) {
        setCachedProfile(currentUserInfo.id, currentUserInfo, currentStickerSets, currentPagination);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки профиля';
      // ✅ Используем setUserError чтобы показать ошибку в UI
      setUserError(errorMessage);
      console.error('❌ Ошибка загрузки профиля:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ REFACTORED: Загрузка информации о текущем пользователе через /api/profiles/me
  const loadUserInfo = async () => {
    setUserLoading(true);
    setUserError(null);

    try {
      // 1) Получаем профиль текущего пользователя через /api/profiles/me
      console.log('🔍 Загрузка профиля текущего пользователя через /api/profiles/me');
      const userProfile = await apiClient.getMyProfile();

      // 2) Фото профиля /users/{id}/photo (404 -> null)
      const photo = await apiClient.getUserPhoto(userProfile.id);

      // 3) Fallback: используем photo_url из Telegram WebApp, если API не вернул фото
      const telegramPhotoUrl = user?.photo_url;

      const combined = {
        ...userProfile,
        profilePhotoFileId: photo?.profilePhotoFileId,
        profilePhotos: photo?.profilePhotos,
        // Используем photo_url из Telegram как fallback, если нет данных из API
        avatarUrl: photo?.profilePhotoFileId || photo?.profilePhotos 
          ? undefined 
          : telegramPhotoUrl
      };

      console.log('✅ Информация о текущем пользователе загружена:', combined);
      setUserInfo(combined as any);
      
      // 4) Загружаем фото как blob URL, если есть fileId или profilePhotos
      if (photo?.profilePhotoFileId || photo?.profilePhotos) {
        loadAvatarBlob(userProfile.id, photo.profilePhotoFileId, photo.profilePhotos);
      } else {
        setAvatarBlobUrl(null);
      }
      
      return combined;
    } catch (error: any) {
      // ✅ Показываем ошибку вместо моковых данных
      console.error('❌ Ошибка загрузки профиля пользователя:', error);
      
      const errorMessage = error?.response?.status === 401
        ? 'Ошибка аутентификации. Попробуйте перезапустить приложение.'
        : error instanceof Error 
          ? error.message 
          : 'Ошибка загрузки пользователя';
      
      setUserError(errorMessage);
      setUserInfo(null);
      // ❌ НЕ пробрасываем ошибку дальше, чтобы не крашить компонент
      return null;
    } finally {
      setUserLoading(false);
    }
  };

  // Загрузка фото профиля как blob URL
  const loadAvatarBlob = useCallback(async (userId: number, fileId?: string, profilePhotos?: any) => {
    // Выбираем оптимальный fileId из profilePhotos, если есть
    let optimalFileId = fileId;
    
    try {
      if (profilePhotos?.photos?.[0]?.[0]) {
        // Используем первое фото из первого набора (текущее фото профиля)
        const photoSet = profilePhotos.photos[0];
        // Выбираем фото размером около 160px или самое большое
        const targetSize = 160;
        let bestPhoto = photoSet.find((p: any) => Math.min(p.width, p.height) >= targetSize);
        if (!bestPhoto) {
          bestPhoto = photoSet.reduce((max: any, p: any) => {
            const maxSize = Math.min(max.width, max.height);
            const photoSize = Math.min(p.width, p.height);
            return photoSize > maxSize ? p : max;
          });
        }
        optimalFileId = bestPhoto?.file_id || fileId;
      }

      if (!optimalFileId) {
        setAvatarBlobUrl(null);
        return;
      }

      // ✅ FIX: Проверяем, не загружается ли уже аватар с таким же fileId
      if (loadingAvatarFileIdRef.current === optimalFileId) {
        console.log('📸 Аватар уже загружается, пропускаем повторную загрузку');
        return;
      }

      // Устанавливаем флаг загрузки
      loadingAvatarFileIdRef.current = optimalFileId;

      try {
        const blob = await apiClient.getUserPhotoBlob(userId, optimalFileId);
        const objectUrl = URL.createObjectURL(blob);
        setAvatarBlobUrl(objectUrl);
      } finally {
        // Сбрасываем флаг после загрузки
        if (loadingAvatarFileIdRef.current === optimalFileId) {
          loadingAvatarFileIdRef.current = null;
        }
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки фото профиля:', error);
      setAvatarBlobUrl(null);
      // Сбрасываем флаг при ошибке
      if (loadingAvatarFileIdRef.current === optimalFileId) {
        loadingAvatarFileIdRef.current = null;
      }
    }
  }, []); // Не добавляем avatarBlobUrl в зависимости, используем ref для отслеживания

  // Загрузка стикерсетов пользователя
  const loadUserStickerSets = async (userIdParam: number, searchQuery?: string, page: number = 0, append: boolean = false, sortByLikesParam?: boolean) => {
    if (append) {
      setIsLoadingMorePublished(true);
    } else {
      setStickerSetsLoading(true);
    }
    setStickerSetsError(null);

    // ✅ Проверяем что userId валидный
    if (typeof userIdParam !== 'number' || Number.isNaN(userIdParam)) {
      console.error('❌ Невалидный userId:', userIdParam);
      setStickerSetsError('Невозможно загрузить стикерсеты: не указан ID пользователя');
      if (!append) {
        setStickerSetsLoading(false);
      } else {
        setIsLoadingMorePublished(false);
      }
      return;
    }

    try {
      console.log('🔍 Загрузка стикерсетов для userId:', userIdParam, 'searchQuery:', searchQuery, 'sortByLikes:', sortByLikesParam, 'page:', page, 'append:', append);
      
      // Если есть поисковый запрос, используем специальный эндпоинт поиска
      if (searchQuery && searchQuery.trim()) {
        console.log('🔍 Выполняем поиск стикерсетов...');
        const response = await apiClient.searchUserStickerSets(userIdParam, searchQuery, page, 20, true);
        console.log('✅ Поиск завершен:', { count: response.content?.length || 0, page: response.number, totalPages: response.totalPages });
        const filteredContent = response.content || [];
        
        if (append) {
          // Добавляем новые стикерсеты к существующим (как в GalleryPage)
          addUserStickerSets(filteredContent);
        } else {
          // Заменяем все стикерсеты
          setUserStickerSets(filteredContent);
        }
        
        // Инициализируем лайки из API данных (как в GalleryPage)
        if (filteredContent.length > 0) {
          initializeLikes(filteredContent, append);
        }
        
        // Обновляем информацию о пагинации (как в GalleryPage)
        setPagination(
          response.number ?? page,
          response.totalPages ?? 0,
          response.totalElements ?? 0
        );
        console.log('✅ Поиск стикерсетов успешно завершен');
        return;
      }
      
      console.log('🔍 Загружаем стикерсеты пользователя...');
      const response = await apiClient.getUserStickerSets(userIdParam, page, 20, 'createdAt', 'DESC', true);
      console.log('✅ Ответ от API получен:', { 
        hasResponse: !!response, 
        contentLength: response?.content?.length || 0,
        page: response?.number,
        totalPages: response?.totalPages 
      });
      const filteredContent = response.content || [];
      
      console.log('✅ Стикерсеты загружены:', {
        count: filteredContent.length,
        page: response.number,
        totalPages: response.totalPages,
        totalElements: response.totalElements,
        append,
        hasNextPage: response.number < response.totalPages - 1
      });
      
      // Инициализируем лайки из API данных
      // При загрузке дополнительных страниц используем mergeMode=true для защиты от перезаписи (как в GalleryPage)
      if (filteredContent.length > 0) {
        initializeLikes(filteredContent, append);
      }
      
      let finalContent = filteredContent;
      if (sortByLikesParam && finalContent.length > 0) {
        finalContent = [...finalContent].sort((a, b) => {
          const likesA = a.likes || a.likesCount || 0;
          const likesB = b.likes || b.likesCount || 0;
          return likesB - likesA;
        });
      }
      
      if (append) {
        // Добавляем новые стикерсеты к существующим (как в GalleryPage)
        addUserStickerSets(finalContent);
      } else {
        // Заменяем все стикерсеты
        setUserStickerSets(finalContent);
      }
      
      // Обновляем информацию о пагинации (как в GalleryPage)
      setPagination(
        response.number ?? page,
        response.totalPages ?? 0,
        response.totalElements ?? 0
      );
    } catch (error: any) {
      // ✅ Показываем ошибку вместо моковых данных
      const errorMessage = error?.response?.status === 401
        ? 'Ошибка аутентификации. Попробуйте перезапустить приложение.'
        : error instanceof Error 
          ? error.message 
          : 'Ошибка загрузки стикерсетов';
      
      console.error('❌ Ошибка загрузки стикерсетов:', {
        error,
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        data: error?.response?.data
      });
      setStickerSetsError(errorMessage);
      
      // Очищаем список стикерсетов при ошибке
      if (!append) {
        setUserStickerSets([]);
        setPagination(0, 1, 0);
      }
    } finally {
      console.log('🔄 Сбрасываем состояние загрузки:', { append, isLoadingMorePublished, isStickerSetsLoading });
      if (append) {
        setIsLoadingMorePublished(false);
      } else {
        setStickerSetsLoading(false);
      }
      console.log('✅ Состояние загрузки сброшено');
    }
  };

  // Обработчики действий
  const handleBack = () => {
    if (isModalOpen) {
      handleCloseModal();
      return;
    }
    navigate('/'); // Возврат на главную
  };

  const handleViewStickerSet = (packId: string) => {
    const source = isLikesTab ? likedStickerSets : userStickerSets;
    const stickerSet = source.find(s => s.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStickerSet(null);
    
    // Локально обновляем список "понравившиеся" если активна вкладка Likes (без запроса к серверу)
    if (isLikesTab && isLikedListLoaded) {
      updateLikedListLocally();
    }
    
    // Инвалидируем кеш профиля при изменении лайков
    if (currentUserId) {
      clearCache(currentUserId);
    }
  };
  

  // Загрузка понравившихся с сервера с поддержкой пагинации
  const loadLikedStickerSets = useCallback(async (page: number = 0, append: boolean = false) => {
    console.log('🔍 loadLikedStickerSets вызван', { page, append });
    try {
      if (append) {
        setIsLikedLoadingMore(true);
      } else {
        console.log('🔄 Устанавливаем isStickerSetsLoading = true для понравившихся');
        setStickerSetsLoading(true);
      }
      
      console.log('🔍 Загружаем понравившиеся стикерсеты...');
      const response = await apiClient.getStickerSets(page, 20, { likedOnly: true, preview: true });
      console.log('✅ Ответ от API для понравившихся получен:', { 
        hasResponse: !!response, 
        contentLength: response?.content?.length || 0,
        page: response?.number,
        totalPages: response?.totalPages 
      });
      const serverLikedSets = response.content || [];
      
      // ✅ FIX: response.number может быть undefined для likedOnly запросов
      // В этом случае используем переданный параметр page
      const actualPage = response.number !== undefined ? response.number : page;
      
      console.log('✅ Понравившиеся загружены:', {
        count: serverLikedSets.length,
        page: actualPage,
        totalPages: response.totalPages,
        totalElements: response.totalElements,
        append,
        hasNextPage: actualPage < response.totalPages - 1
      });
      
      // Инициализируем лайки из серверных данных
      // Важно: все стикерсеты из likedOnly должны быть лайкнуты
      // При загрузке дополнительных страниц используем mergeMode=true для защиты от перезаписи (как в GalleryPage)
      if (serverLikedSets.length > 0) {
        // Убеждаемся, что все стикерсеты помечены как лайкнутые
        const setsWithLikes = serverLikedSets.map(set => ({
          ...set,
          isLikedByCurrentUser: true, // Все из likedOnly должны быть лайкнуты
          isLiked: true // Для совместимости со старым API
        }));
        initializeLikes(setsWithLikes, append);
      }
      
      // Обновляем пагинацию
      setLikedCurrentPage(actualPage);
      setLikedTotalPages(response.totalPages);
      
      // Сохраняем загруженные данные
      if (append) {
        // Добавляем новые данные к существующим, убирая дубликаты
        setLikedStickerSets(prev => {
          const existingIds = new Set(prev.map(s => String(s.id)));
          const unique = serverLikedSets.filter(s => !existingIds.has(String(s.id)));
          return [...prev, ...unique];
        });
      } else {
        setLikedStickerSets(serverLikedSets);
        // Сохраняем исходные ID для защиты от случайного удаления
        setOriginalLikedSetIds(new Set(serverLikedSets.map(s => String(s.id))));
        setIsLikedListLoaded(true);
      }
    } catch (e) {
      console.warn('⚠️ Не удалось загрузить понравившиеся с сервера', e);
      if (!append) {
        setLikedStickerSets([]);
        setOriginalLikedSetIds(new Set());
        setIsLikedListLoaded(false);
      }
    } finally {
      console.log('🔄 Сбрасываем состояние загрузки понравившихся:', { append, isLikedLoadingMore, isStickerSetsLoading });
      if (append) {
        setIsLikedLoadingMore(false);
      } else {
        setStickerSetsLoading(false);
      }
      console.log('✅ Состояние загрузки понравившихся сброшено');
    }
  }, [initializeLikes]);
  
  // Локальное обновление списка при изменении лайков (без запроса к серверу)
  const updateLikedListLocally = useCallback(() => {
    const { isLiked: isLikedFn, likes } = useLikesStore.getState();
    
    setLikedStickerSets(prev => {
      // Фильтруем: оставляем только те, что либо лайкнуты в store, либо были в исходном списке с сервера
      // Это предотвращает удаление карточек до их полной инициализации в store
      const withoutRemoved = prev.filter(s => {
        const packId = String(s.id);
        const likeState = likes[packId];
        // Если есть состояние в store - используем его
        if (likeState !== undefined) {
          return likeState.isLiked;
        }
        // Если нет в store, но был в исходном списке с сервера - оставляем (еще не обновился)
        // Это защищает от удаления карточек до их полной инициализации
        return originalLikedSetIds.has(packId);
      });
      
      // Получаем текущие лайкнутые стикерсеты из доступных источников
      // (для добавления новых, которые были лайкнуты локально)
      const allAvailableSets = [...userStickerSets];
      const newlyLiked = allAvailableSets.filter(s => {
        const packId = String(s.id);
        const isCurrentlyLiked = isLikedFn(packId);
        const alreadyInList = prev.some(p => String(p.id) === packId);
        return isCurrentlyLiked && !alreadyInList;
      });
      
      // Объединяем существующие и новые, убираем дубликаты
      if (newlyLiked.length > 0) {
        const unique = Array.from(
          new Map([...withoutRemoved, ...newlyLiked].map(s => [String(s.id), s])).values()
        );
        return unique;
      }
      
      // Если ничего не изменилось, возвращаем прежний список
      return withoutRemoved;
    });
  }, [userStickerSets, originalLikedSetIds]);
  
  // При обновлении профиля (монтирование компонента или изменение пользователя) - сбрасываем флаг
  useEffect(() => {
    setIsLikedListLoaded(false);
    setOriginalLikedSetIds(new Set());
    setLikedCurrentPage(0);
    setLikedTotalPages(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);
  
  // Загружаем с сервера при первом открытии вкладки "Likes"
  useEffect(() => {
    if (activeProfileTab === 1 && !isLikedListLoaded && !isStickerSetsLoading && !isLikedLoadingMore) {
      loadLikedStickerSets(0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileTab, isLikedListLoaded, isStickerSetsLoading, isLikedLoadingMore]);
  
  // Локально обновляем список при изменении лайков (вкладка Likes)
  useEffect(() => {
    if (activeProfileTab === 1 && isLikedListLoaded) {
      updateLikedListLocally();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedIdsHash, activeProfileTab, isLikedListLoaded]);


  const handleCreateSticker = () => {
    setIsUploadModalOpen(true);
  };

  // Обработка поиска
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  // Обработка поиска с отправкой
  const handleSearch = (searchTermValue: string) => {
    const userId = currentUserId;
    if (!userId) return;
    
    if (searchTermValue.trim()) {
      loadUserStickerSets(userId, searchTermValue, 0, false, sortByLikes);
    } else {
      loadUserStickerSets(userId, undefined, 0, false, sortByLikes);
    }
  };

  // Обработка переключения сортировки
  const handleSortToggle = () => {
    const newSortByLikes = !sortByLikes;
    setSortByLikes(newSortByLikes);
    const userId = currentUserId;
    if (userId) {
      loadUserStickerSets(userId, searchTerm || undefined, 0, false, newSortByLikes);
    }
  };

  // Обработчики загрузки следующих страниц (стабильные функции для IntersectionObserver)
  // Используем логику из GalleryPage: проверяем currentPage < totalPages - 1 && !isLoadingMore
  const handleLoadMorePublished = useCallback(() => {
    // Не загружаем следующую страницу при активном поиске
    if (searchTerm && searchTerm.trim()) {
      console.log('⏸️ Пагинация отключена при поиске');
      return;
    }
    if (currentUserId && !isLoadingMorePublished && currentPage < totalPages - 1) {
      const nextPage = currentPage + 1;
      console.log('📄 Загрузка следующей страницы "Мои":', {
        currentPage,
        nextPage,
        totalPages,
        hasNextPage: currentPage < totalPages - 1
      });
      loadUserStickerSets(currentUserId, undefined, nextPage, true, sortByLikes);
    } else {
      console.log('⏸️ Не загружаем следующую страницу "Мои":', {
        currentUserId: !!currentUserId,
        isLoadingMorePublished,
        currentPage,
        totalPages,
        hasNextPage: currentPage < totalPages - 1
      });
    }
  }, [currentUserId, currentPage, totalPages, searchTerm, sortByLikes, isLoadingMorePublished, loadUserStickerSets]);

  const handleLoadMoreLiked = useCallback(() => {
    if (!isLikedLoadingMore && likedCurrentPage < likedTotalPages - 1) {
      const nextPage = likedCurrentPage + 1;
      console.log('📄 Загрузка следующей страницы "Понравившиеся":', {
        currentPage: likedCurrentPage,
        nextPage,
        totalPages: likedTotalPages,
        hasNextPage: likedCurrentPage < likedTotalPages - 1
      });
      loadLikedStickerSets(nextPage, true);
    } else {
      console.log('⏸️ Не загружаем следующую страницу "Понравившиеся":', {
        isLikedLoadingMore,
        currentPage: likedCurrentPage,
        totalPages: likedTotalPages,
        hasNextPage: likedCurrentPage < likedTotalPages - 1
      });
    }
  }, [likedCurrentPage, likedTotalPages, isLikedLoadingMore, loadLikedStickerSets]);

  // Фильтрация стикерсетов (при поиске данные уже отфильтрованы на сервере)
  const filteredStickerSets = userStickerSets;

  // Обработка кнопки "Назад" в Telegram
  useEffect(() => {
    if (tg?.BackButton) {
      tg.BackButton.onClick(handleBack);
      tg.BackButton.show();
    }

    return () => {
      if (tg?.BackButton) {
        tg.BackButton.hide();
      }
    };
  }, [tg]);

  console.log('🔍 MyProfilePage состояние:', {
    currentUserId,
    userInfo: userInfo?.firstName,
    stickerSetsCount: userStickerSets.length,
    filteredCount: filteredStickerSets.length,
    isLoading,
    isUserLoading,
    isStickerSetsLoading,
    isLoadingMorePublished,
    activeProfileTab: activeProfileTab,
    // Пагинация "Мои"
    publishedPagination: {
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages - 1
    },
    // Пагинация "Понравившиеся"
    likedPagination: {
      currentPage: likedCurrentPage,
      totalPages: likedTotalPages,
      hasNextPage: likedCurrentPage < likedTotalPages - 1,
      count: likedStickerSets.length
    }
  });

  // Основные ошибки (показываем только в Telegram приложении)
  if (error && isInTelegramApp) {
    return (
      <div className="error-page-container">
        <StixlyPageContainer className="error-container">
          <div className="error-alert" role="alert">
            <Text variant="body" color="default">{error}</Text>
          </div>
          <EmptyState
            title="❌ Ошибка"
            message="Не удалось загрузить ваш профиль"
            actionLabel="Вернуться на главную"
            onAction={() => navigate('/')}
          />
        </StixlyPageContainer>
      </div>
    );
  }

  // Обновляем userInfo с blob URL для аватара
  const userInfoWithAvatar = useMemo(() => {
    if (!userInfo) return null;
    return {
      ...userInfo,
      avatarUrl: avatarBlobUrl || userInfo.avatarUrl
    };
  }, [userInfo, avatarBlobUrl]);

  // Cleanup blob URL при размонтировании
  useEffect(() => {
    return () => {
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl);
      }
    };
  }, [avatarBlobUrl]);



  return (
    <div className={cn('page-container', 'my-profile-page', 'account-page', isInTelegramApp && 'telegram-app')}>
      {/* Head account (Figma): шапка профиля без Header Panel */}
      <div
        className={cn('head-account', isInTelegramApp && 'head-account--telegram')}
        data-figma-block="Head account"
      >
        {/* Если есть ошибка но нет загрузки - показываем блок с ошибкой */}
        {!isUserLoading && userError && !userInfo && (
          <div className="error-box">
            <ErrorDisplay 
              error={userError} 
              onRetry={() => loadMyProfile(true)}
            />
          </div>
        )}
        
        {userInfo && (
          <div className="head-account__card">
            {/* Аватар 80×80 внутри карточки (Figma ACCOUNT) */}
            <div className="head-account__avatar">
              {userInfoWithAvatar?.avatarUrl ? (
                <img src={userInfoWithAvatar.avatarUrl} alt="" />
              ) : (
                <Text variant="h2" weight="bold" style={{ color: '#fff' }}>
                  {(userInfo?.username || user?.username || '?').slice(0, 1).toUpperCase()}
                </Text>
              )}
            </div>
            {/* Имя пользователя */}
            <Text variant="h2" weight="bold" className="head-account__name" as="div">
              {userInfo?.username ? `@${userInfo.username}` : user?.username ? `@${user.username}` : '—'}
            </Text>
            {/* Статистика: 2 колонки (Наборов / ART) */}
            <div className="head-account__info">
              <div className="head-account__stat">
                <span className="head-account__stat-value">{userStickerSets.length}</span>
                <span className="head-account__stat-label">sticker packs</span>
              </div>
              <div className="head-account__stat">
                <span className="head-account__stat-value">{userInfo.artBalance || 0}</span>
                <span className="head-account__stat-label">Artpoints</span>
              </div>
            </div>
            {/* Кошелёк: кнопка "Connect wallet" (Figma) или адрес */}
            <div className="head-account__wallet">
              {!wallet ? (
                <button
                  type="button"
                  className="head-account__connect-wallet-btn"
                  onClick={() => {
                    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                    tonConnectUI?.openModal?.();
                  }}
                  disabled={walletLoading}
                >
                  Connect wallet
                </button>
              ) : (
                <div className="wallet-menu-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={(event) => {
                      if (tg?.HapticFeedback) {
                        tg.HapticFeedback.impactOccurred('light');
                      }
                      setWalletMenuAnchor(event.currentTarget);
                    }}
                    className="my-profile-wallet-button"
                    disabled={walletLoading}
                    style={{
                      background: 'transparent',
                      borderColor: 'rgba(255,255,255,0.5)',
                      color: '#fff',
                      width: '100%',
                      maxWidth: '370px'
                    }}
                  >
                    {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
                  </Button>
                  {Boolean(walletMenuAnchor) && (
                    <div className="wallet-menu" role="menu">
                      <button
                        className="wallet-menu-item"
                        onClick={async () => {
                          setWalletMenuAnchor(null);
                          if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                          try {
                            await unlinkWallet(tonConnectUI);
                          } catch (err) {
                            console.error('[MyProfilePage] Ошибка отключения кошелька', err);
                          }
                        }}
                        disabled={walletLoading}
                        type="button"
                      >
                        {walletLoading ? 'Отключение...' : 'Отключить кошелёк'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {walletLoading && !wallet && (
              <Text variant="caption" className="my-profile-wallet-loading">
                Загрузка...
              </Text>
            )}
            {walletError && (
              <div className="my-profile-wallet-error" role="alert">
                <Text variant="bodySmall" color="default">{walletError}</Text>
              </div>
            )}
          </div>
        )}

        {/* Ошибка пользователя */}
        {userError && isInTelegramApp && (
          <div className="error-alert-inline" role="alert">
            <Text variant="body" color="default">{userError}</Text>
          </div>
        )}
      </div>

      {/* Вкладки Stickers | Art-points — между head-account и head-account-tabs-wrap */}
      {userInfo && (
        <div className="account-main-tabs-wrap">
          <div role="tablist" className="account-main-tabs" aria-label="Stickers or Art-points">
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 0}
              id="account-main-tab-stickers"
              aria-controls="account-main-panel-stickers"
              onClick={() => setMainTab(0)}
              className={cn('account-main-tabs__tab', mainTab === 0 && 'account-main-tabs__tab--active')}
            >
              Stickers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === 1}
              id="account-main-tab-artpoints"
              aria-controls="account-main-panel-artpoints"
              onClick={() => setMainTab(1)}
              className={cn('account-main-tabs__tab', mainTab === 1 && 'account-main-tabs__tab--active')}
            >
              Art-points
            </button>
          </div>
        </div>
      )}

      {/* Stickers: head-account-tabs-wrap (Create/Likes/Upload) + контент галерей */}
      {userInfo && mainTab === 0 && (
        <div className="head-account-tabs-wrap">
          <ProfileTabs
            variant="account"
            activeTab={activeProfileTab}
            onChange={setActiveProfileTab}
            isInTelegramApp={isInTelegramApp}
          />
        </div>
      )}

      {/* Прокручиваемый контент: при Stickers — галереи; при Art-points — account-menu-content (quests) */}
      <StixlyPageContainer className="page-container-no-padding-top">
        {mainTab === 0 ? (
        <>
            {/* Tab 0: Create — стикеры, которые можно создать и загрузить (без quests сверху) */}
            <TabPanel value={activeProfileTab} index={0}>
              <div ref={tabsContainerRef} className="my-profile-tabs-container">
                <CompactControlsBar
                  variant="static"
                  searchValue={searchTerm}
                  onSearchChange={handleSearchChange}
                  onSearch={handleSearch}
                  searchDisabled={isStickerSetsLoading}
                  categories={categories}
                  selectedCategories={[]}
                  onCategoryToggle={() => {}}
                  categoriesDisabled={true}
                  sortByLikes={sortByLikes}
                  onSortToggle={handleSortToggle}
                  sortDisabled={isStickerSetsLoading || !!searchTerm}
                  selectedStickerTypes={[]}
                  onStickerTypeToggle={() => {}}
                  selectedStickerSetTypes={[]}
                  onStickerSetTypeToggle={() => {}}
                  selectedDate={null}
                  onDateChange={() => {}}
                  onAddClick={() => setIsUploadModalOpen(true)}
                />
              </div>
              {isStickerSetsLoading ? (
                <LoadingSpinner message="Загрузка стикерсетов..." />
              ) : stickerSetsError && isInTelegramApp ? (
                <ErrorDisplay
                  error={stickerSetsError}
                  onRetry={() => currentUserId && loadUserStickerSets(currentUserId, searchTerm || undefined, 0, false, sortByLikes)}
                />
              ) : filteredStickerSets.length === 0 ? (
                <div className="flex-column-center py-3 px-1 my-profile-empty-state-container">
                  <Text variant="h3" className="my-profile-empty-state-title">
                    📁 У вас пока нет стикерсетов
                  </Text>
                  <Text variant="bodySmall" className="my-profile-empty-state-message">
                    {searchTerm ? 'По вашему запросу ничего не найдено' : 'Добавьте стикер'}
                  </Text>
                  <div className="my-profile-empty-state-button-container">
                    <Button
                      variant="primary"
                      size="large"
                      onClick={() => {
                        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                        handleCreateSticker();
                      }}
                      className={cn('button-base button-rounded-md my-profile-add-button', isLightTheme ? 'light-theme' : 'dark-theme')}
                    >
                      <span className="button-icon">+</span>
                      Добавьте стикерпак
                      <span className={cn('my-profile-add-button-chip', isLightTheme ? 'light-theme' : 'dark-theme')}>
                        +10 ART
                      </span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="fade-in">
                  <OptimizedGallery
                    variant="account"
                    packs={adaptStickerSetsToGalleryPacks(filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                    hasNextPage={!searchTerm && currentPage < totalPages - 1}
                    isLoadingMore={isLoadingMorePublished}
                    onLoadMore={handleLoadMorePublished}
                    scrollElement={scrollElement}
                  />
                </div>
              )}
            </TabPanel>

            {/* Tab 1: Likes — понравившиеся стикерсеты */}
            <TabPanel value={activeProfileTab} index={1}>
              {isStickerSetsLoading ? (
                <LoadingSpinner message="Загрузка..." />
              ) : likedStickerSets.length === 0 ? (
                <EmptyState
                  title="❤️ Likes"
                  message="Like sticker packs in the gallery and they will appear here"
                />
              ) : (
                <div className="fade-in">
                  <OptimizedGallery
                    variant="account"
                    packs={adaptStickerSetsToGalleryPacks(likedStickerSets)}
                    onPackClick={handleViewStickerSet}
                    hasNextPage={likedCurrentPage < likedTotalPages - 1}
                    isLoadingMore={isLikedLoadingMore}
                    onLoadMore={handleLoadMoreLiked}
                    scrollElement={scrollElement}
                  />
                </div>
              )}
            </TabPanel>

            {/* Tab 2: Upload — загруженные пользователем стикерсеты */}
            <TabPanel value={activeProfileTab} index={2}>
              <div ref={tabsContainerRef} className="my-profile-tabs-container">
                <CompactControlsBar
                  variant="static"
                  searchValue={searchTerm}
                  onSearchChange={handleSearchChange}
                  onSearch={handleSearch}
                  searchDisabled={isStickerSetsLoading}
                  categories={categories}
                  selectedCategories={[]}
                  onCategoryToggle={() => {}}
                  categoriesDisabled={true}
                  sortByLikes={sortByLikes}
                  onSortToggle={handleSortToggle}
                  sortDisabled={isStickerSetsLoading || !!searchTerm}
                  selectedStickerTypes={[]}
                  onStickerTypeToggle={() => {}}
                  selectedStickerSetTypes={[]}
                  onStickerSetTypeToggle={() => {}}
                  selectedDate={null}
                  onDateChange={() => {}}
                  onAddClick={() => setIsUploadModalOpen(true)}
                />
              </div>
              {isStickerSetsLoading ? (
                <LoadingSpinner message="Загрузка стикерсетов..." />
              ) : stickerSetsError && isInTelegramApp ? (
                <ErrorDisplay
                  error={stickerSetsError}
                  onRetry={() => currentUserId && loadUserStickerSets(currentUserId, searchTerm || undefined, 0, false, sortByLikes)}
                />
              ) : filteredStickerSets.length === 0 ? (
                <div className="flex-column-center py-3 px-1 my-profile-empty-state-container">
                  <Text variant="h3" className="my-profile-empty-state-title">
                    📁 У вас пока нет загруженных стикерсетов
                  </Text>
                  <Text variant="bodySmall" className="my-profile-empty-state-message">
                    {searchTerm ? 'По вашему запросу ничего не найдено' : 'Добавьте стикерпак'}
                  </Text>
                  <div className="my-profile-empty-state-button-container">
                    <Button
                      variant="primary"
                      size="large"
                      onClick={() => {
                        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                        handleCreateSticker();
                      }}
                      className={cn('button-base button-rounded-md my-profile-add-button', isLightTheme ? 'light-theme' : 'dark-theme')}
                    >
                      <span className="button-icon">+</span>
                      Добавьте стикерпак
                      <span className={cn('my-profile-add-button-chip', isLightTheme ? 'light-theme' : 'dark-theme')}>
                        +10 ART
                      </span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="fade-in">
                  <OptimizedGallery
                    variant="account"
                    packs={adaptStickerSetsToGalleryPacks(filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                    hasNextPage={!searchTerm && currentPage < totalPages - 1}
                    isLoadingMore={isLoadingMorePublished}
                    onLoadMore={handleLoadMorePublished}
                    scrollElement={scrollElement}
                  />
                </div>
              )}
              <AddStickerPackButton
                variant="profile"
                onClick={() => setIsUploadModalOpen(true)}
              />
            </TabPanel>
        </>
        ) : mainTab === 1 ? (
          /* Art-points: account-menu-content, конкретно account-quests-grid */
          <div className="account-menu-content" id="account-main-panel-artpoints" role="tabpanel" aria-labelledby="account-main-tab-artpoints">
            <div className="account-quests-grid">
              <QuestStixlyCard
                title="Quest Stixly"
                description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris sed venenatis nibh."
                onStart={() => {}}
              />
              <QuestStixlyCard
                title="Quest Stixly 2"
                description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris sed venenatis nibh."
                onStart={() => {}}
              />
            </div>
            <DailyActivityBlock
              tasks={[
                { id: '1', title: 'Visit Project', progress: 1, total: 1, status: 'calm' },
                { id: '2', title: 'Upgrade 10 ...', progress: 5, total: 10, reward: '100 ART', status: 'go-up' },
                { id: '3', title: 'Share two Stickers', progress: 2, total: 2, status: 'calm' },
                { id: '4', title: 'Visit Project', progress: 1, total: 1, status: 'calm' },
              ]}
            />
            <GlobalActivityBlock
              tasks={[
                { id: 'g1', title: 'Connect TON', progress: 1, total: 1, reward: '1,000 ART', status: 'calm' },
                { id: 'g2', title: 'Invite friends', progress: 5, total: 10, reward: '100 ART', status: 'go-up' },
                { id: 'g3', title: 'Donate authors', progress: 1, total: 1, reward: '100 ART', status: 'calm' },
                { id: 'g4', title: 'Like 10 stickers', progress: 5, total: 10, reward: '100 ART', status: 'go-up' },
              ]}
            />
          </div>
        ) : null}
      </StixlyPageContainer>

      {/* Нижняя навигация */}
      {/* Модалка деталей стикерсета */}
      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
        enableCategoryEditing={true}
        onLike={(id) => {
          // Настоящее переключение лайка через store
          useLikesStore.getState().toggleLike(String(id));
        }}
        onStickerSetUpdated={handleStickerSetUpdated}
        onCategoriesUpdated={handleStickerSetUpdated}
      />

      {/* Debug панель */}
      <DebugPanel initData={initData} />

      {/* Модальное окно загрузки стикерпака */}
      <UploadStickerPackModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onComplete={async () => {
          // ✅ REFACTORED: Обновляем профиль без параметров
          await loadMyProfile(true);
          const refreshedUserId = useProfileStore.getState().userInfo?.id;
          if (refreshedUserId) {
            await loadUserStickerSets(refreshedUserId, searchTerm || undefined, 0, false, sortByLikes);
          }
        }}
      />
    </div>
  );
};

