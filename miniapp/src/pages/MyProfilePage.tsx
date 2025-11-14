import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box,
  Alert,
  Button,
  Typography,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { useLikesStore } from '@/store/useLikesStore';
import { apiClient } from '@/api/client';
import { StickerSetResponse } from '@/types/sticker';

// Компоненты
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { FloatingAvatar } from '@/components/FloatingAvatar';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { EmptyState } from '@/components/EmptyState';
import { StickerPackModal } from '@/components/StickerPackModal';
import { SimpleGallery } from '@/components/SimpleGallery';
import { DebugPanel } from '@/components/DebugPanel';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { ProfileTabs, TabPanel } from '@/components/ProfileTabs';
import { isUserPremium } from '@/utils/userUtils';
import { UploadStickerPackModal } from '@/components/UploadStickerPackModal';
import { AddStickerPackButton } from '@/components/AddStickerPackButton';
import { SortButton } from '@/components/SortButton';

export const MyProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { tg, user, initData, isInTelegramApp } = useTelegram();

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
    setError,
    setUserError,
    setStickerSetsError,
    getCachedProfile,
    setCachedProfile,
    isCacheValid,
    clearCache,
    reset
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
  // Фильтр "Сеты": опубликованные (мои) vs понравившиеся
  const [setsFilter, setSetsFilter] = useState<'published' | 'liked'>('published');
  const [likedStickerSets, setLikedStickerSets] = useState<any[]>([]);
  // Флаг: был ли список загружен с сервера (для оптимизации - не загружаем повторно)
  const [isLikedListLoaded, setIsLikedListLoaded] = useState(false);
  // Сохраняем исходный список для защиты от удаления карточек до инициализации в store
  const [originalLikedSetIds, setOriginalLikedSetIds] = useState<Set<string>>(new Set());
  // Пагинация для понравившихся
  const [likedCurrentPage, setLikedCurrentPage] = useState(0);
  const [likedTotalPages, setLikedTotalPages] = useState(1);
  const [isLikedLoadingMore, setIsLikedLoadingMore] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState(0); // 0: стикерсеты, 1: баланс, 2: поделиться
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [sortByLikes, setSortByLikes] = useState(false);
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null);
  // Отдельное состояние для загрузки следующей страницы "Мои" (аналогично GalleryPage)
  const [isLoadingMorePublished, setIsLoadingMorePublished] = useState(false);

  // ✅ REFACTORED: Больше не зависим от user.id из Telegram
  // currentUserId будет получен из /api/profiles/me
  const currentUserId = userInfo?.id;

  useEffect(() => {
    console.log('🔍 MyProfilePage: Текущий пользователь:', user);
    console.log('🔍 MyProfilePage: initData:', initData ? `${initData.length} chars` : 'empty');
    
    // ✅ УПРОЩЕНО: Удалена проверка кэша из useEffect
    // Проблема: если в кэше были старые моковые данные (ivan_ivanov),
    // они загружались и делался return, не вызывая loadMyProfile() для получения реальных данных
    // 
    // Теперь loadMyProfile() сам решает использовать кэш или нет

    // Настраиваем заголовки: initData либо заголовки расширения в dev
    if (initData) {
      apiClient.setAuthHeaders(initData);
    } else {
      apiClient.checkExtensionHeaders();
    }

    // ✅ REFACTORED: Загружаем профиль без параметров (используется /api/profiles/me)
    // Оборачиваем в async для перехвата ошибок
    (async () => {
      try {
        await loadMyProfile();
      } catch (error) {
        // Ошибка уже обработана в loadMyProfile и установлена в userError
        console.log('🔍 Ошибка при загрузке профиля перехвачена в useEffect');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ REFACTORED: Загрузка своего профиля через /api/profiles/me с кэшированием
  const loadMyProfile = async (forceReload: boolean = false) => {
    // Для кэширования используем специальный ключ 'me' вместо telegramId
    const cacheKey = 'me';
    
    // Проверяем кэш (по ключу 'me')
    if (!forceReload) {
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
    try {
      // Выбираем оптимальный fileId из profilePhotos, если есть
      let optimalFileId = fileId;
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

      const blob = await apiClient.getUserPhotoBlob(userId, optimalFileId);
      const objectUrl = URL.createObjectURL(blob);
      setAvatarBlobUrl(objectUrl);
    } catch (error) {
      console.error('❌ Ошибка загрузки фото профиля:', error);
      setAvatarBlobUrl(null);
    }
  }, []);

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
      console.log('🔍 Загрузка стикерсетов для userId:', userIdParam, 'searchQuery:', searchQuery, 'sortByLikes:', sortByLikesParam);
      
      // Если есть поисковый запрос, используем специальный эндпоинт поиска
      if (searchQuery && searchQuery.trim()) {
        const response = await apiClient.searchUserStickerSets(userIdParam, searchQuery, page, 20);
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
        return;
      }
      
      const response = await apiClient.getUserStickerSets(userIdParam, page, 20, 'createdAt', 'DESC');
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
      
      console.error('❌ Ошибка загрузки стикерсетов:', error);
      setStickerSetsError(errorMessage);
      
      // Очищаем список стикерсетов при ошибке
      if (!append) {
        setUserStickerSets([]);
        setPagination(0, 1, 0);
      }
    } finally {
      if (append) {
        setIsLoadingMorePublished(false);
      } else {
        setStickerSetsLoading(false);
      }
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
    const source = setsFilter === 'liked' ? likedStickerSets : userStickerSets;
    const stickerSet = source.find(s => s.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStickerSet(null);
    
    // Локально обновляем список "понравившиеся" если активен этот фильтр (без запроса к серверу)
    if (setsFilter === 'liked' && isLikedListLoaded) {
      updateLikedListLocally();
    }
    
    // Инвалидируем кеш профиля при изменении лайков
    if (currentUserId) {
      clearCache(currentUserId);
    }
  };
  

  const handleShareStickerSet = (name: string, _title: string) => {
    if (tg) {
      tg.openTelegramLink(`https://t.me/addstickers/${name}`);
    } else {
      window.open(`https://t.me/addstickers/${name}`, '_blank');
    }
  };

  // Загрузка понравившихся с сервера с поддержкой пагинации
  const loadLikedStickerSets = useCallback(async (page: number = 0, append: boolean = false) => {
    try {
      if (append) {
        setIsLikedLoadingMore(true);
      } else {
        setStickerSetsLoading(true);
      }
      
      const response = await apiClient.getStickerSets(page, 20, { likedOnly: true });
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
      if (append) {
        setIsLikedLoadingMore(false);
      } else {
        setStickerSetsLoading(false);
      }
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
  
  // Загружаем с сервера только при первом открытии вкладки "Понравившиеся"
  useEffect(() => {
    if (setsFilter === 'liked' && !isLikedListLoaded && !isStickerSetsLoading && !isLikedLoadingMore) {
      loadLikedStickerSets(0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setsFilter, isLikedListLoaded, isStickerSetsLoading, isLikedLoadingMore]);
  
  // Локально обновляем список при изменении лайков (без запроса к серверу)
  useEffect(() => {
    if (setsFilter === 'liked' && isLikedListLoaded) {
      updateLikedListLocally();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedIdsHash, setsFilter, isLikedListLoaded]);


  const handleCreateSticker = () => {
    setIsUploadModalOpen(true);
  };

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/profile/${userInfo?.id}`;
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(`Мой профиль в Sticker Gallery`)}`);
    } else {
      navigator.share?.({
        title: 'Мой профиль в Sticker Gallery',
        url: profileUrl
      }).catch(() => {
        // Fallback для браузеров без поддержки Web Share API
        navigator.clipboard.writeText(profileUrl);
        alert('Ссылка на профиль скопирована в буфер обмена');
      });
    }
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
    setsFilter,
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
      <Box sx={{ 
        minHeight: '100vh', 
        backgroundColor: 'var(--tg-theme-bg-color)',
        color: 'var(--tg-theme-text-color)'
      }}>
        <Container maxWidth="lg" sx={{ py: 2 }}>
          <Alert severity="error" sx={{ 
            mb: 2,
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            border: '1px solid var(--tg-theme-border-color)'
          }}>
            {error}
          </Alert>
          <EmptyState
            title="❌ Ошибка"
            message="Не удалось загрузить ваш профиль"
            actionLabel="Вернуться на главную"
            onAction={() => navigate('/')}
          />
        </Container>
      </Box>
    );
  }

  // Проверка premium статуса
  const isPremium = userInfo ? isUserPremium(userInfo) : false;

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
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
      color: 'var(--tg-theme-text-color, #000000)',
      paddingBottom: isInTelegramApp ? 0 : 8,
      overflowX: 'hidden'
    }}>
      {/* Профильный header */}
      <StixlyTopHeader
        profileMode={{
          enabled: true,
          backgroundColor: isPremium 
            ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' 
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          pattern: isPremium ? 'waves' : 'dots',
          content: isUserLoading ? (
            <LoadingSpinner message="Загрузка профиля..." />
          ) : userError ? (
            <Box sx={{ 
              width: '100%', 
              height: '100%',
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              justifyContent: 'center',
              padding: 3,
              textAlign: 'center'
            }}>
              <ErrorDisplay 
                error={userError} 
                onRetry={() => loadMyProfile(true)}
              />
            </Box>
          ) : userInfo ? (
            <Box sx={{ 
              width: '100%', 
              height: '100%',
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Аватар с overlap - наполовину на header */}
              <Box sx={{ 
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translate(-50%, 50%)',
                zIndex: 20
              }}>
                <FloatingAvatar userInfo={userInfoWithAvatar || userInfo} size="large" overlap={0} />
              </Box>
            </Box>
          ) : null
        }}
        showThemeToggle={false}
      />

      {/* Карточка с достижениями под аватаром */}
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, mt: 0 }}>
        {/* Если есть ошибка но нет загрузки - показываем блок с ошибкой */}
        {!isUserLoading && userError && !userInfo && (
          <Box sx={{ 
            mt: 4, 
            p: 3, 
            textAlign: 'center',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
            borderRadius: 3
          }}>
            <ErrorDisplay 
              error={userError} 
              onRetry={() => loadMyProfile(true)}
            />
          </Box>
        )}
        
        {userInfo && (
          <Card sx={{ 
            borderRadius: 3,
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
            border: '1px solid var(--tg-theme-border-color, #e0e0e0)',
            boxShadow: 'none',
            pt: 0,
            pb: 2
          }}>
            <CardContent sx={{ pt: 6, color: 'var(--tg-theme-text-color, #000000)' }}>
              {/* Статистика */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-around', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2
              }}>
                <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold"
                    sx={{ color: 'var(--tg-theme-button-color)' }}
                  >
                    {userStickerSets.length}
                  </Typography>
                  <Typography 
                    variant="body2"
                    sx={{ color: 'var(--tg-theme-hint-color)' }}
                  >
                    Наборов
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold"
                    sx={{ color: 'var(--tg-theme-button-color)' }}
                  >
                    {userInfo?.username ? `@${userInfo.username}` : user?.username ? `@${user.username}` : '—'}
                  </Typography>
                </Box>
                
                <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                  <Typography 
                    variant="h5" 
                    fontWeight="bold"
                    sx={{ 
                      color: 'var(--tg-theme-button-color)',
                      // Золотой оттенок для ART в светлой теме
                      filter: 'brightness(1.1) saturate(1.2)'
                    }}
                  >
                    {userInfo.artBalance || 0}
                  </Typography>
                  <Typography 
                    variant="body2"
                    sx={{ color: 'var(--tg-theme-hint-color)' }}
                  >
                    ART
                  </Typography>
                </Box>
              </Box>
              
              {/* Кнопка поделиться профилем */}
              {/* Кнопка "Поделиться профилем" удалена по требованиям дизайна */}
            </CardContent>
          </Card>
        )}

        {/* Ошибка пользователя */}
        {userError && isInTelegramApp && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 2,
              mb: 2,
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
              color: 'var(--tg-theme-text-color, #000000)',
              border: '1px solid var(--tg-theme-border-color, #e0e0e0)'
            }}
          >
            {userError}
          </Alert>
        )}

        {/* Вкладки профиля */}
        {userInfo && (
          <ProfileTabs
            activeTab={activeProfileTab}
            onChange={setActiveProfileTab}
            isInTelegramApp={isInTelegramApp}
          />
        )}
      </Container>

      {/* Прокручиваемый контент */}
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, pb: 2 }}>
        <>
            {/* Контент вкладок - прокручиваемый */}
            <TabPanel value={activeProfileTab} index={0}>
              {/* Переключатель Published/Liked */}
              <Box sx={{ display: 'flex', gap: '0.618rem', mb: '0.618rem', mt: '-0.618rem' }}>
                <Chip
                  label="Мои"
                  color={setsFilter === 'published' ? 'primary' : 'default'}
                  variant={setsFilter === 'published' ? 'filled' : 'outlined'}
                  onClick={() => setSetsFilter('published')}
                  sx={{ 
                    borderRadius: '0.618rem',
                    transform: 'none !important',
                    '&:hover': {
                      transform: 'none !important'
                    },
                    '&:active': {
                      transform: 'none !important'
                    }
                  }}
                />
                <Chip
                  label="Понравившиеся"
                  color={setsFilter === 'liked' ? 'primary' : 'default'}
                  variant={setsFilter === 'liked' ? 'filled' : 'outlined'}
                  onClick={() => {
                    setSetsFilter('liked');
                    // Список обновится в useEffect при изменении setsFilter
                  }}
                  sx={{ 
                    borderRadius: '0.618rem',
                    transform: 'none !important',
                    '&:hover': {
                      transform: 'none !important'
                    },
                    '&:active': {
                      transform: 'none !important'
                    }
                  }}
                />
              </Box>

              {/* Поиск и сортировка */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.618rem', mb: '0.618rem', px: '0.618rem' }}>
                <Box sx={{ flex: 1 }}>
                  <SearchBar
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onSearch={handleSearch}
                    placeholder="Поиск моих стикерсетов..."
                    disabled={isStickerSetsLoading}
                  />
                </Box>
                <SortButton
                  sortByLikes={sortByLikes}
                  onToggle={handleSortToggle}
                  disabled={isStickerSetsLoading || !!searchTerm}
                />
              </Box>

              {/* Контент стикерсетов */}
              {isStickerSetsLoading ? (
                <LoadingSpinner message="Загрузка стикерсетов..." />
              ) : stickerSetsError && isInTelegramApp ? (
                <ErrorDisplay 
                  error={stickerSetsError} 
                  onRetry={() => currentUserId && loadUserStickerSets(currentUserId, searchTerm || undefined, 0, false, sortByLikes)} 
                />
              ) : (setsFilter === 'liked' ? likedStickerSets.length === 0 : filteredStickerSets.length === 0) ? (
                <EmptyState
                  title={setsFilter === 'liked' ? '❤️ Понравившихся пока нет' : '📁 У вас пока нет стикерсетов'}
                  message={
                    setsFilter === 'liked' 
                      ? 'Лайкните понравившиеся наборы в галерее, и они появятся здесь'
                      : (searchTerm 
                          ? 'По вашему запросу ничего не найдено' 
                          : 'Создайте свой первый набор стикеров!')
                  }
                  actionLabel="Создать стикер"
                  onAction={handleCreateSticker}
                />
                              ) : (
                  <SimpleGallery
                    packs={adaptStickerSetsToGalleryPacks(setsFilter === 'liked' ? likedStickerSets : filteredStickerSets)}
                    onPackClick={handleViewStickerSet}
                    hasNextPage={
                      setsFilter === 'liked' 
                        ? likedCurrentPage < likedTotalPages - 1 
                        : !searchTerm && currentPage < totalPages - 1
                    }
                    isLoadingMore={setsFilter === 'liked' ? isLikedLoadingMore : isLoadingMorePublished}
                    onLoadMore={setsFilter === 'liked' ? handleLoadMoreLiked : handleLoadMorePublished}
                    enablePreloading={true}
                    usePageScroll={false}
                    addButtonElement={setsFilter === 'published' ? (
                      <AddStickerPackButton
                        variant="gallery"
                        onClick={() => setIsUploadModalOpen(true)}
                      />
                    ) : undefined}
                  />
                )}

              {/* Кнопка "Показать ещё" убрана, так как SimpleGallery использует infinite scroll */}
              {false && filteredStickerSets.length > 0 && (currentPage < totalPages - 1) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => currentUserId && loadUserStickerSets(currentUserId, undefined, currentPage + 1, true)}
                  >
                    Показать ещё
                  </Button>
                </Box>
              )}
            </TabPanel>

            <TabPanel value={activeProfileTab} index={1}>
              {/* Баланс ART */}
              <Card sx={{ 
                mb: 2, 
                borderRadius: 3,
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                color: 'var(--tg-theme-text-color)',
                border: '1px solid var(--tg-theme-border-color)',
                boxShadow: '0 2px 8px var(--tg-theme-shadow-color)'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <AccountBalanceWalletIcon sx={{ fontSize: 40, color: 'var(--tg-theme-button-color)' }} />
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        Баланс ART
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
                        Ваши стикер-токены
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                    <Chip 
                      label={`${userInfo?.artBalance || 0} ART`}
                      sx={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 'bold',
                        height: 56,
                        px: 3,
                        backgroundColor: 'var(--tg-theme-button-color)',
                        color: 'var(--tg-theme-button-text-color)'
                      }}
                    />
                  </Box>

                  <Typography variant="body2" sx={{ 
                    color: 'var(--tg-theme-hint-color)', 
                    textAlign: 'center', 
                    mt: 2 
                  }}>
                    Создавайте стикеры и зарабатывайте ART токены!
                  </Typography>
                </CardContent>
              </Card>

              {/* Кнопка создания стикерпака */}
              <AddStickerPackButton
                variant="profile"
                onClick={() => setIsUploadModalOpen(true)}
              />
            </TabPanel>

            <TabPanel value={activeProfileTab} index={2}>
              {/* Достижения профиля */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                alignItems: 'center',
                justifyContent: 'center',
                py: 5,
                minHeight: '220px'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                  Достижения
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    Сеты: {userStickerSets.length}
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    Стикеры: {userStickerSets.reduce((s, set) => s + (set.stickerCount || 0), 0)}
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)' }}>
                    ART: {userInfo?.artBalance || 0}
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)', textAlign: 'center' }}>
                  Скоро появятся уровни, streak и редкие ачивки.
                </Typography>
              </Box>
            </TabPanel>
        </>
      </Container>

      {/* Нижняя навигация */}
      {/* Модалка деталей стикерсета */}
      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={handleCloseModal}
        onLike={(id) => {
          // Настоящее переключение лайка через store
          useLikesStore.getState().toggleLike(String(id));
        }}
        onStickerSetUpdated={handleStickerSetUpdated}
      />

      {/* Debug панель */}
      {initData && <DebugPanel initData={initData} />}

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
    </Box>
  );
};

