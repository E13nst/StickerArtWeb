import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Popover,
  SvgIcon,
  TextField
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DownloadIcon from '@mui/icons-material/Download';
import { StickerSetResponse, CategoryResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { getStickerThumbnailUrl, getStickerImageUrl } from '@/utils/stickerUtils';
import { AnimatedSticker } from './AnimatedSticker';
import { StickerThumbnail } from './StickerThumbnail';
import { useLikesStore } from '@/store/useLikesStore';
import { prefetchSticker, getCachedStickerUrl, getCachedStickerMediaType, markAsGallerySticker, LoadPriority } from '@/utils/imageLoader';
import { useTelegram } from '@/hooks/useTelegram';
import { Link } from 'react-router-dom';
import { imageCache } from '@/utils/imageLoader';
import { useProfileStore } from '@/store/useProfileStore';
import { useStickerStore } from '@/store/useStickerStore';
import { StickerSetActions } from './StickerSetActions';
import type { SvgIconProps } from '@mui/material/SvgIcon';

// Кеш полных данных стикерсетов для оптимистичного UI
interface CachedStickerSet {
  data: StickerSetResponse;
  timestamp: number;
  ttl: number; // Время жизни кеша в миллисекундах
}

const stickerSetCache = new Map<number, CachedStickerSet>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

type VisibilityState = 'public' | 'private';

const deriveVisibilityState = (data?: StickerSetResponse | null): VisibilityState => {
  if (!data) return 'public';
  const visibility = (data as any)?.visibility ?? (data as any)?.status ?? (data as any)?.publishedStatus;
  const isPrivate = (data as any)?.isPrivate;
  const isPublished = (data as any)?.isPublished;

  if (typeof isPrivate === 'boolean') {
    return isPrivate ? 'private' : 'public';
  }

  if (typeof isPublished === 'boolean') {
    return isPublished ? 'public' : 'private';
  }

  if (typeof visibility === 'string') {
    const normalized = visibility.toLowerCase();
    if (['private', 'hidden', 'invisible'].includes(normalized)) {
      return 'private';
    }
    if (['public', 'visible', 'published'].includes(normalized)) {
      return 'public';
    }
  }

  return 'public';
};

const applyVisibilityToStickerSet = (data: StickerSetResponse, visibility: VisibilityState): StickerSetResponse => ({
  ...data,
  isPublished: visibility === 'public',
  isPrivate: visibility === 'private',
  visibility: visibility === 'public' ? 'PUBLIC' : 'PRIVATE'
});

const EyePublishedIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 16 16">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 8L3.07945 4.30466C4.29638 2.84434 6.09909 2 8 2C9.90091 2 11.7036 2.84434 12.9206 4.30466L16 8L12.9206 11.6953C11.7036 13.1557 9.90091 14 8 14C6.09909 14 4.29638 13.1557 3.07945 11.6953L0 8ZM8 11C9.65685 11 11 9.65685 11 8C11 6.34315 9.65685 5 8 5C6.34315 5 5 6.34315 5 8C5 9.65685 6.34315 11 8 11Z"
      fill="currentColor"
    />
  </SvgIcon>
);

const EyeUnpublishedIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 16 16">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16 16H13L10.8368 13.3376C9.96488 13.7682 8.99592 14 8 14C6.09909 14 4.29638 13.1557 3.07945 11.6953L0 8L3.07945 4.30466C3.14989 4.22013 3.22229 4.13767 3.29656 4.05731L0 0H3L16 16ZM5.35254 6.58774C5.12755 7.00862 5 7.48941 5 8C5 9.65685 6.34315 11 8 11C8.29178 11 8.57383 10.9583 8.84053 10.8807L5.35254 6.58774Z"
      fill="currentColor"
    />
    <path
      d="M16 8L14.2278 10.1266L7.63351 2.01048C7.75518 2.00351 7.87739 2 8 2C9.90091 2 11.7036 2.84434 12.9206 4.30466L16 8Z"
      fill="currentColor"
    />
  </SvgIcon>
);

// Компонент для ленивой загрузки миниатюр
interface LazyThumbnailProps {
  sticker: any;
  index: number;
  activeIndex: number;
  onClick: (idx: number) => void;
}

const renderStickerMedia = (
  sticker: any,
  opts: {
    size?: number | string;
    width?: number | string;
    height?: number | string;
    className?: string;
    onLoad?: () => void;
  } = {}
) => {
  if (!sticker) return null;
  const { size, width: widthProp, height: heightProp, className, onLoad } = opts;
  const computedWidth = widthProp ?? size ?? '100%';
  const computedHeight = heightProp ?? size ?? '100%';
  const width = typeof computedWidth === 'number' ? `${computedWidth}px` : computedWidth;
  const height = typeof computedHeight === 'number' ? `${computedHeight}px` : computedHeight;
  const cachedUrl = getCachedStickerUrl(sticker.file_id);
  const cachedType = getCachedStickerMediaType(sticker.file_id);

  if (sticker.is_video || sticker.isVideo || cachedType === 'video') {
    return (
      <video
        src={cachedUrl || getStickerImageUrl(sticker.file_id)}
        autoPlay
        loop
        muted
        playsInline
        className={className}
        style={{
          width,
          height,
          objectFit: 'contain'
        }}
        onLoadedData={onLoad}
      />
    );
  }

  if (sticker.is_animated || sticker.isAnimated) {
    return (
      <AnimatedSticker
        fileId={sticker.file_id}
        imageUrl={getStickerImageUrl(sticker.file_id)}
        hidePlaceholder
        className={className}
        onReady={onLoad}
      />
    );
  }

  return (
    <img
      src={cachedUrl || getStickerImageUrl(sticker.file_id)}
      alt={sticker.emoji || ''}
      className={className}
      style={{
        width,
        height,
        objectFit: 'contain'
      }}
      loading="eager"
      onLoad={onLoad}
    />
  );
};

const LazyThumbnail: React.FC<LazyThumbnailProps> = memo(({
  sticker,
  index,
  activeIndex,
  onClick
}) => {
  const isActive = index === activeIndex;

  return (
    <Box
      data-thumbnail-index={index}
      data-active={isActive}
      onClick={() => onClick(index)}
      sx={{
        flex: '0 0 auto',
        width: 128,
        height: 128,
        minWidth: 128,
        minHeight: 128,
        borderRadius: 'var(--tg-radius-m)',
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : 'rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 120ms ease, border-color 120ms ease, background-color 200ms ease',
        '&:active': { transform: 'scale(0.98)' },
        position: 'relative'
      }}
    >
          <StickerThumbnail
            fileId={sticker.file_id}
            thumbFileId={sticker.thumb?.file_id}
            emoji={sticker.emoji}
            size={128}
          />
          {sticker.emoji && (
            <Box sx={{
              position: 'absolute',
              bottom: 'var(--tg-spacing-2)',
              left: 'var(--tg-spacing-2)',
              color: 'white',
              fontSize: 'var(--tg-font-size-xl)',
              textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 3px 6px rgba(0,0,0,0.35)'
            }}>
              {sticker.emoji}
        </Box>
      )}
    </Box>
  );
});

LazyThumbnail.displayName = 'LazyThumbnail';

interface StickerSetDetailProps {
  stickerSet: StickerSetResponse;
  onBack: () => void;
  onShare: (name: string, title: string) => void;
  onLike?: (id: number, title: string) => void;
  isInTelegramApp?: boolean;
  isModal?: boolean;
  enableCategoryEditing?: boolean;
  infoVariant?: 'default' | 'minimal';
  onCategoriesUpdated?: (updated: StickerSetResponse) => void;
  onStickerSetUpdated?: (updated: StickerSetResponse) => void;
}

export const StickerSetDetail: React.FC<StickerSetDetailProps> = ({
  stickerSet,
  onBack,
  onShare,
  onLike,
  isInTelegramApp: _isInTelegramApp = false,
  isModal = false,
  enableCategoryEditing = false,
  infoVariant = 'default',
  onCategoriesUpdated,
  onStickerSetUpdated
}) => {
  const { initData, user } = useTelegram();
  const {
    userInfo,
    currentUserId: storeUserId,
    currentUserRole: storeUserRole,
    hasMyProfileLoaded,
    initializeCurrentUser,
  } = useProfileStore((state) => ({
    userInfo: state.userInfo,
    currentUserId: state.currentUserId,
    currentUserRole: state.currentUserRole,
    hasMyProfileLoaded: state.hasMyProfileLoaded,
    initializeCurrentUser: state.initializeCurrentUser,
  }));
  // Оптимистичный UI: показываем данные из пропсов сразу, обновляем когда загрузятся полные данные
  const [fullStickerSet, setFullStickerSet] = useState<StickerSetResponse | null>(() => {
    // Проверяем кеш при инициализации
    const cached = stickerSetCache.get(stickerSet.id);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('✅ Загружено из кеша:', stickerSet.id);
      return cached.data;
    }
    // Если кеша нет, используем данные из пропсов
    return stickerSet;
  });
  const [loading, setLoading] = useState(false); // Начинаем с false для оптимистичного UI
  const [error, setError] = useState<string | null>(null);


  const [likeAnim, setLikeAnim] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const [isMainLoaded, setIsMainLoaded] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const touchHandledRef = useRef(false);
  const [isCategoriesDialogOpen, setIsCategoriesDialogOpen] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<CategoryResponse[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(null);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  const [isSavingCategories, setIsSavingCategories] = useState(false);
  const [categorySaveError, setCategorySaveError] = useState<string | null>(null);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const effectiveStickerSet = fullStickerSet ?? stickerSet;
  
  // Отладочный лог для E2E тестов
  console.log('🔵 StickerSetDetail render:', {
    stickerSetId: effectiveStickerSet.id,
    hasFullStickerSet: !!fullStickerSet,
    availableActions: effectiveStickerSet.availableActions,
    isBlocked: effectiveStickerSet.isBlocked
  });
  
  const [draftVisibility, setDraftVisibility] = useState<VisibilityState>(() =>
    deriveVisibilityState(fullStickerSet ?? stickerSet)
  );
  const [isVisibilityUpdating, setIsVisibilityUpdating] = useState(false);
  const [visibilityInfoAnchor, setVisibilityInfoAnchor] = useState<HTMLElement | null>(null);
  const visibilityInfoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStickerSetBlocked = Boolean(effectiveStickerSet?.isBlocked);
  const currentBlockReason = effectiveStickerSet?.blockReason;
  const displayedCategories = useMemo(() => {
    return effectiveStickerSet?.categories ?? stickerSet.categories ?? [];
  }, [effectiveStickerSet?.categories, stickerSet.categories]);
  const currentCategoryKeys = useMemo(() => {
    return displayedCategories
      .map((category) => category?.key)
      .filter((key): key is string => Boolean(key));
  }, [displayedCategories]);
  const displayTitle = useMemo(() => {
    return fullStickerSet?.title || stickerSet.title;
  }, [fullStickerSet?.title, stickerSet.title]);

  useEffect(() => {
    if (!hasMyProfileLoaded) {
      const fallbackId =
        userInfo?.telegramId ?? userInfo?.id ?? user?.id ?? null;
      initializeCurrentUser(fallbackId).catch(() => undefined);
    }
  }, [hasMyProfileLoaded, initializeCurrentUser, userInfo?.telegramId, userInfo?.id, user?.id]);

  const viewerUserId = storeUserId ?? userInfo?.telegramId ?? userInfo?.id ?? user?.id ?? null;
  const viewerRole = storeUserRole ?? userInfo?.role ?? null;
  const currentUserId = viewerUserId;
  const ownerId = useMemo(() => {
    const primary = fullStickerSet?.authorId ?? stickerSet.authorId;
    return primary ?? null;
  }, [fullStickerSet?.authorId, stickerSet.authorId]);
  const normalizedRole = (viewerRole ?? '').toUpperCase();
  const isAdmin = normalizedRole.includes('ADMIN');
  const isAuthor = currentUserId !== null && ownerId !== null && Number(currentUserId) === Number(ownerId);
  const canToggleVisibility = (isAuthor || isAdmin) && Boolean(stickerSet.id);
  // Редактирование категорий доступно, если:
  // 1. Явно разрешено через enableCategoryEditing (например, на странице "Мои стикеры"), И
  // 2. Пользователь - автор стикерсета (загрузил его) или администратор
  const canEditCategories = enableCategoryEditing && (isAuthor || isAdmin);

  useEffect(() => {
    if (!isCategoriesDialogOpen) {
      setSelectedCategoryKeys(currentCategoryKeys);
    }
  }, [currentCategoryKeys, isCategoriesDialogOpen]);


  useEffect(() => {
    setDraftVisibility(deriveVisibilityState(fullStickerSet ?? stickerSet));
  }, [
    fullStickerSet?.id,
    fullStickerSet?.isPublished,
    fullStickerSet?.isPrivate,
    fullStickerSet?.visibility,
    fullStickerSet?.updatedAt,
    stickerSet.id,
    stickerSet.isPublished,
    stickerSet.isPrivate,
    stickerSet.visibility,
    stickerSet.updatedAt
  ]);

  useEffect(() => {
    return () => {
      if (visibilityInfoTimeoutRef.current) {
        clearTimeout(visibilityInfoTimeoutRef.current);
        visibilityInfoTimeoutRef.current = null;
      }
    };
  }, []);

  // Используем глобальный store для лайков с селекторами для автоматического обновления
  const { isLiked: liked, likesCount: likes } = useLikesStore((state) => 
    state.likes[stickerSet.id.toString()] || { 
      packId: stickerSet.id.toString(), 
      isLiked: false, 
      likesCount: 0 
    }
  );
  const toggleLike = useLikesStore((state) => state.toggleLike);
  const setLike = useLikesStore((state) => state.setLike);
  const getLikeState = useLikesStore((state) => state.getLikeState);
  useEffect(() => {
    let isMounted = true;

    const targetAuthorId = stickerSet.authorId;

    if (!targetAuthorId) {
      setAuthorUsername(null);
      return;
    }

    const effectiveInitData =
      initData ||
      window.Telegram?.WebApp?.initData ||
      '';

    apiClient.setAuthHeaders(effectiveInitData, user?.language_code);
    setAuthorUsername(null);

    (async () => {
      try {
        const userInfo = await apiClient.getTelegramUser(targetAuthorId);
        if (!isMounted) {
          return;
        }
        const fromUsername = userInfo.username?.trim();
        const fallbackName = [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ').trim();
        const displayName = fromUsername && fromUsername.length > 0 ? `@${fromUsername}` : fallbackName || null;
        setAuthorUsername(displayName);
      } catch {
        if (isMounted) {
          setAuthorUsername(null);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [stickerSet.authorId, initData, user?.language_code]);

  // Функция предзагрузки больших стикеров (ОСТОРОЖНО: загружает ВСЕ стикеры из набора)
  // Загружает батчами с интервалами для предотвращения rate limiting от Telegram Bot API
  const preloadLargeStickers = useCallback(async (stickers: any[]) => {
    if (!isModal) return; // Предзагружаем только в модальном окне
    
    // Ограничиваем количество стикеров для предзагрузки - только первые 20
    // Остальные загружаются по требованию при прокрутке
    const stickersToPreload = stickers.slice(0, 20);
    
    if (stickersToPreload.length === 0) return;
    
    console.log(`🔄 Preloading ${stickersToPreload.length} large stickers with MODAL priority (batched)...`);
    
    // Загружаем батчами по 3 стикера с интервалом 200мс между батчами
    // Это предотвращает перегрузку Telegram Bot API
    const batchSize = 3;
    const batchInterval = 200; // 200мс между батчами
    
    for (let i = 0; i < stickersToPreload.length; i += batchSize) {
      const batch = stickersToPreload.slice(i, i + batchSize);
      
      // Загружаем батч параллельно с максимальным приоритетом для модального окна
      const batchPromises = batch.map((sticker) => {
        const imageUrl = getStickerImageUrl(sticker.file_id);
        return prefetchSticker(sticker.file_id, imageUrl, {
          isAnimated: Boolean(sticker.is_animated || sticker.isAnimated),
          isVideo: Boolean(sticker.is_video || sticker.isVideo),
          markForGallery: true,
          priority: LoadPriority.TIER_0_MODAL // Максимальный приоритет для модального окна
        }).catch(() => {
          // Игнорируем ошибки отдельных стикеров
        });
      });
      
      await Promise.allSettled(batchPromises);
      
      // Ждем перед следующим батчем (кроме последнего)
      if (i + batchSize < stickersToPreload.length) {
        await new Promise(resolve => setTimeout(resolve, batchInterval));
      }
    }
    
    console.log(`✅ Preloaded ${stickersToPreload.length} large stickers`);
  }, [isModal]);

  // Не инициализируем лайки из пропсов - только из API данных

  // Загружаем полную информацию о стикерсете и метаданные ПАРАЛЛЕЛЬНО (оптимистично - в фоне)
  useEffect(() => {
    let mounted = true;
    let abortController: AbortController | null = null;
    
    const loadFullStickerSet = async () => {
      // Проверяем кеш перед загрузкой
      const cached = stickerSetCache.get(stickerSet.id);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        console.log('✅ Используем кешированные данные:', stickerSet.id);
        if (mounted) {
          setFullStickerSet(cached.data);
          // Инициализируем лайки из кеша
          const apiLikesCount = cached.data.likesCount ?? cached.data.likes;
          const apiIsLiked = cached.data.isLikedByCurrentUser ?? cached.data.isLiked;
          if (apiLikesCount !== undefined && apiLikesCount >= 0) {
            setLike(stickerSet.id.toString(), apiIsLiked ?? false, apiLikesCount);
          }
        }
        return; // Не загружаем если есть свежий кеш
      }
      
      try {
        // Показываем индикатор загрузки только если данных еще нет
        if (!fullStickerSet || fullStickerSet.id !== stickerSet.id) {
          setLoading(true);
        }
        setError(null);
        
        // Создаем AbortController для возможности отмены
        abortController = new AbortController();
        
        // Загружаем полную информацию о стикерсете
        const fullData = await apiClient.getStickerSet(stickerSet.id);
        
        if (!mounted || abortController.signal.aborted) return;
        
        // Сохраняем в кеш
        stickerSetCache.set(stickerSet.id, {
          data: fullData,
          timestamp: Date.now(),
          ttl: CACHE_TTL
        });
        
        // Ограничиваем размер кеша (удаляем старые записи)
        if (stickerSetCache.size > 50) {
          const oldestKey = Array.from(stickerSetCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
          if (oldestKey) stickerSetCache.delete(oldestKey);
        }
        
        if (mounted) {
          setFullStickerSet(fullData);
          
          // Инициализируем лайки только если API предоставляет данные
          const apiLikesCount = fullData.likesCount ?? fullData.likes;
          const apiIsLiked = fullData.isLikedByCurrentUser ?? fullData.isLiked;
          
          if (apiLikesCount !== undefined && apiLikesCount >= 0) {
            const currentState = getLikeState(stickerSet.id.toString());
            
            setLike(
              stickerSet.id.toString(), 
              apiIsLiked ?? currentState.isLiked,
              apiLikesCount
            );
            
            console.log(`🔍 DEBUG StickerSetDetail: Инициализация лайков для ${stickerSet.id}:`, {
              apiLikesCount,
              apiIsLiked,
              currentState
            });
          }
          
          // Умная предзагрузка: только первые 15 стикеров для миниатюр
          const stickers = fullData.telegramStickerSetInfo?.stickers || [];
          stickers.forEach((sticker) => {
            if (sticker?.file_id) {
              markAsGallerySticker(sticker.file_id);
            }
          });
 
          if (!mounted || abortController.signal.aborted) return;
          
          await preloadLargeStickers(stickers);
        }
      } catch (err) {
        if (!mounted || abortController?.signal.aborted) return;
        
        console.warn('Ошибка загрузки полной информации о стикерсете:', err);
        if (mounted) {
          setError('Не удалось загрузить полную информацию о стикерсете');
          // Используем данные из пропсов как fallback (уже есть в fullStickerSet)
          if (!fullStickerSet) {
            setFullStickerSet(stickerSet);
          }
        }
      } finally {
        if (mounted && !abortController?.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFullStickerSet();
    
    return () => { 
      mounted = false;
      abortController?.abort();
    };
  }, [stickerSet.id, getLikeState, setLike, preloadLargeStickers]);

  // Мемоизируем список стикеров для оптимизации рендеринга
  const stickers = useMemo(() => {
    return effectiveStickerSet?.telegramStickerSetInfo?.stickers ?? [];
  }, [effectiveStickerSet?.telegramStickerSetInfo?.stickers]);
  
  useEffect(() => {
    if (!isModal) return;
    const currentSticker = stickers[activeIndex];
    if (currentSticker?.file_id) {
      prefetchSticker(currentSticker.file_id, getStickerImageUrl(currentSticker.file_id), {
        isAnimated: Boolean(currentSticker.is_animated || currentSticker.isAnimated),
        isVideo: Boolean(currentSticker.is_video || currentSticker.isVideo),
        markForGallery: true,
        priority: LoadPriority.TIER_0_MODAL // Максимальный приоритет для текущего стикера в модальном окне
      }).catch(() => {});
    }
  }, [activeIndex, stickers, isModal]);
  
  // Мемоизируем количество стикеров
  const stickerCount = useMemo(() => {
    return stickers.length;
  }, [stickers.length]);

  useEffect(() => {
    setIsMainLoaded(false);
    const currentSticker = stickers[activeIndex];
    if (
      currentSticker &&
      !Boolean(currentSticker.is_animated || currentSticker.isAnimated) &&
      !Boolean(currentSticker.is_video || currentSticker.isVideo) &&
      (imageCache.get(currentSticker.file_id) || getCachedStickerUrl(currentSticker.file_id))
    ) {
      setIsMainLoaded(true);
    }
  }, [activeIndex, stickers]);
  
  // Отладочная информация (только в dev режиме)
  if ((import.meta as any).env?.DEV) {
    console.log('🎯 StickerSetDetail:', {
      stickerSetId: stickerSet.id,
      loading,
      error,
      fullStickerSet: !!fullStickerSet,
      stickersCount: stickers.length
    });
  }

  const goToNextSticker = useCallback(() => {
    if (stickerCount <= 1) return;
    setActiveIndex((prev) => (prev + 1) % stickerCount);
  }, [stickerCount]);

  const goToPrevSticker = useCallback(() => {
    if (stickerCount <= 1) return;
    setActiveIndex((prev) => (prev - 1 + stickerCount) % stickerCount);
  }, [stickerCount]);

  const handleStickerClick = useCallback((index: number) => {
    setActiveIndex(index);
    if (scrollerRef.current) {
      const node = scrollerRef.current.querySelector(`[data-thumbnail-index="${index}"]`);
      if (node) {
        (node as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (stickerCount <= 1) return;
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchCurrentXRef.current = touch.clientX;
  }, [stickerCount]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    touchCurrentXRef.current = event.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (stickerCount <= 1) return;
    const start = touchStartXRef.current;
    const end = touchCurrentXRef.current ?? start;
    let handled = false;

    if (start !== null && end !== null) {
      const delta = end - start;
      if (Math.abs(delta) > 40) {
        if (delta > 0) {
          goToPrevSticker();
        } else {
          goToNextSticker();
        }
        handled = true;
      }
    }

    touchStartXRef.current = null;
    touchCurrentXRef.current = null;

    if (handled) {
      touchHandledRef.current = true;
      window.setTimeout(() => {
        touchHandledRef.current = false;
      }, 0);
    } else {
      touchHandledRef.current = false;
    }
  }, [goToNextSticker, goToPrevSticker, stickerCount]);

  const handleTouchCancel = useCallback(() => {
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
  }, []);

  const loadCategories = useCallback(async () => {
    if (availableCategories.length > 0) {
      return;
    }
    setCategoriesLoading(true);
    setCategoriesLoadError(null);
    try {
      const data = await apiClient.getCategories();
      setAvailableCategories(data);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось загрузить категории';
      setCategoriesLoadError(message);
    } finally {
      setCategoriesLoading(false);
    }
  }, [availableCategories.length]);


  const handleOpenCategoriesDialog = useCallback(() => {
    setSelectedCategoryKeys(currentCategoryKeys);
    setCategorySaveError(null);
    setCategoriesLoadError(null);
    setIsCategoriesDialogOpen(true);
    loadCategories();
  }, [currentCategoryKeys, loadCategories]);

  const handleCloseCategoriesDialog = useCallback(() => {
    if (isSavingCategories) return;
    setIsCategoriesDialogOpen(false);
  }, [isSavingCategories]);

  const handleToggleCategory = useCallback((key: string) => {
    setSelectedCategoryKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  }, []);

  const handleSaveCategories = useCallback(async () => {
    setIsSavingCategories(true);
    setCategorySaveError(null);
    try {
      const updated = await apiClient.updateStickerSetCategories(stickerSet.id, selectedCategoryKeys);
      // Сохраняем telegramStickerSetInfo из текущего состояния, чтобы не потерять превью
      const mergedUpdate = {
        ...updated,
        telegramStickerSetInfo: updated.telegramStickerSetInfo || fullStickerSet?.telegramStickerSetInfo || stickerSet.telegramStickerSetInfo,
        previewStickers: updated.previewStickers || fullStickerSet?.previewStickers || stickerSet.previewStickers
      };
      console.log('✅ Категории сохранены, обновляем стикерсет:', mergedUpdate);
      setFullStickerSet(mergedUpdate);
      onCategoriesUpdated?.(mergedUpdate);
      setIsCategoriesDialogOpen(false);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось сохранить категории. Попробуйте позже.';
      setCategorySaveError(message);
    } finally {
      setIsSavingCategories(false);
    }
  }, [selectedCategoryKeys, stickerSet.id, onCategoriesUpdated, fullStickerSet, stickerSet]);

  const handleOpenBlockDialog = useCallback(() => {
    setBlockReasonInput('');
    setBlockError(null);
    setIsBlockDialogOpen(true);
  }, []);

  const handleCloseBlockDialog = useCallback(() => {
    if (isBlocking) return;
    setIsBlockDialogOpen(false);
    setBlockError(null);
    setBlockReasonInput('');
  }, [isBlocking]);

  const handleBlockStickerSet = useCallback(async () => {
    if (!effectiveStickerSet?.id) {
      return;
    }
    setIsBlocking(true);
    setBlockError(null);
    try {
      const updated = await apiClient.blockStickerSet(
        effectiveStickerSet.id,
        blockReasonInput.trim() ? blockReasonInput.trim() : undefined
      );
      const mergedUpdate: StickerSetResponse = {
        ...(fullStickerSet ?? stickerSet),
        ...updated,
        telegramStickerSetInfo:
          updated.telegramStickerSetInfo || fullStickerSet?.telegramStickerSetInfo || stickerSet.telegramStickerSetInfo,
        previewStickers: updated.previewStickers || fullStickerSet?.previewStickers || stickerSet.previewStickers,
        // Сохраняем availableActions из ответа API
        availableActions: updated.availableActions
      };
      console.log('✅ Стикерсет обновлён после блокировки:', { 
        id: mergedUpdate.id, 
        isBlocked: mergedUpdate.isBlocked, 
        availableActions: mergedUpdate.availableActions 
      });
      setFullStickerSet(mergedUpdate);
      onStickerSetUpdated?.(mergedUpdate);
      setIsBlockDialogOpen(false);
      setBlockReasonInput('');
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось заблокировать стикерсет.';
      setBlockError(message);
    } finally {
      setIsBlocking(false);
    }
  }, [effectiveStickerSet?.id, blockReasonInput, fullStickerSet, stickerSet, onStickerSetUpdated]);

  // Обработчик завершения действия из StickerSetActions
  const handleActionComplete = useCallback(async (action: string, updatedData?: StickerSetResponse) => {
    console.log('🎬 handleActionComplete вызван:', { action, hasUpdatedData: !!updatedData });
    
    if (action === 'DELETE') {
      // Для DELETE закрываем модальное окно или возвращаемся назад
      if (isModal) {
        onBack();
      } else {
        onBack();
      }
      return;
    }

    // Если есть updatedData от API действия, используем его напрямую
    // (он уже содержит актуальное состояние после операции)
    if (!updatedData) {
      console.error('❌ handleActionComplete: updatedData не передан для действия', action);
      return;
    }

    console.log('📦 Используем updatedData от API действия:', {
      id: updatedData.id,
      availableActions: updatedData.availableActions,
      isBlocked: updatedData.isBlocked,
      isPublic: updatedData.isPublic
    });
    
    const mergedUpdate: StickerSetResponse = {
      ...(fullStickerSet ?? stickerSet),
      ...updatedData,
      telegramStickerSetInfo:
        updatedData.telegramStickerSetInfo || fullStickerSet?.telegramStickerSetInfo || stickerSet.telegramStickerSetInfo,
      previewStickers: updatedData.previewStickers || fullStickerSet?.previewStickers || stickerSet.previewStickers,
      // Сохраняем availableActions из ответа API
      availableActions: updatedData.availableActions
    };

    console.log('✅ Стикерсет обновлён:', { 
      id: mergedUpdate.id, 
      action, 
      availableActions: mergedUpdate.availableActions,
      isBlocked: mergedUpdate.isBlocked,
      isPublic: mergedUpdate.isPublic
    });

    // Обновляем локальное состояние
    setFullStickerSet(mergedUpdate);

    // Обновляем кеш
    stickerSetCache.set(stickerSet.id, {
      data: mergedUpdate,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });

    // Обновляем глобальные stores
    useStickerStore.getState().updateStickerSet(stickerSet.id, mergedUpdate);
    useProfileStore.getState().updateUserStickerSet(stickerSet.id, mergedUpdate);

    // Уведомляем родительский компонент
    onStickerSetUpdated?.(mergedUpdate);
  }, [stickerSet.id, isModal, onBack, fullStickerSet, stickerSet, onStickerSetUpdated]);


  const handleVisibilityInfoClose = useCallback(() => {
    if (visibilityInfoTimeoutRef.current) {
      window.clearTimeout(visibilityInfoTimeoutRef.current);
      visibilityInfoTimeoutRef.current = null;
    }
    setVisibilityInfoAnchor(null);
  }, []);

  const handleVisibilityToggle = useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      if (!canToggleVisibility || isVisibilityUpdating) {
        return;
      }

      const anchor = event.currentTarget as HTMLElement;
      const previousVisibility = draftVisibility;
      const previousFull = fullStickerSet;
      const next: VisibilityState = draftVisibility === 'public' ? 'private' : 'public';

      setDraftVisibility(next);
      setFullStickerSet((prev) =>
        prev ? applyVisibilityToStickerSet(prev, next) : applyVisibilityToStickerSet(stickerSet, next)
      );

      if (visibilityInfoTimeoutRef.current) {
        clearTimeout(visibilityInfoTimeoutRef.current);
        visibilityInfoTimeoutRef.current = null;
      }
      setVisibilityInfoAnchor(null);

      setIsVisibilityUpdating(true);
      try {
        const response =
          next === 'public'
            ? await apiClient.publishStickerSet(stickerSet.id)
            : await apiClient.unpublishStickerSet(stickerSet.id);

        const responseVisibility = deriveVisibilityState(response);
        const finalVisibilityState = response ? responseVisibility : next;
        const baseData = response
          ? applyVisibilityToStickerSet(response, finalVisibilityState)
          : applyVisibilityToStickerSet(previousFull ?? stickerSet, finalVisibilityState);
        
        // Сохраняем availableActions из ответа API
        const finalData: StickerSetResponse = {
          ...baseData,
          availableActions: response?.availableActions
        };

        setFullStickerSet(finalData);
        setDraftVisibility(finalVisibilityState);

        stickerSetCache.set(stickerSet.id, {
          data: finalData,
          timestamp: Date.now(),
          ttl: CACHE_TTL
        });

        useStickerStore.getState().updateStickerSet(stickerSet.id, finalData);
        useProfileStore.getState().updateUserStickerSet(stickerSet.id, finalData);

        onStickerSetUpdated?.(finalData);

        setVisibilityInfoAnchor(anchor);
        visibilityInfoTimeoutRef.current = setTimeout(() => {
          setVisibilityInfoAnchor(null);
          visibilityInfoTimeoutRef.current = null;
        }, 2800);
      } catch (error: any) {
        console.error('❌ Ошибка при обновлении приватности стикерсета:', error);
        setFullStickerSet(previousFull ?? stickerSet);
        setDraftVisibility(previousVisibility);

        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Не удалось обновить видимость стикерсета. Попробуйте позже.';

        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(message);
        }
      } finally {
        setIsVisibilityUpdating(false);
      }
    },
    [canToggleVisibility, draftVisibility, fullStickerSet, isVisibilityUpdating, stickerSet]
  );

  useEffect(() => {
    if (!scrollerRef.current) return;
    const container = scrollerRef.current;
    const activeThumbnail = container.querySelector<HTMLElement>(`[data-thumbnail-index="${activeIndex}"]`);
    if (!activeThumbnail) return;

    const containerWidth = container.clientWidth;
    const elementWidth = activeThumbnail.offsetWidth;
    const elementLeft = activeThumbnail.offsetLeft;

    const targetLeft = elementLeft - (containerWidth - elementWidth) / 2;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth'
    });
  }, [activeIndex]);

  const handleLikeClick = async () => {
    const willLike = !liked;
    setLikeAnim(true);
    window.setTimeout(() => setLikeAnim(false), 220);
    
    try {
      await toggleLike(stickerSet.id.toString());
      
      // Обновляем кеш при изменении лайков
      const cached = stickerSetCache.get(stickerSet.id);
      if (cached) {
        const updatedData = {
          ...cached.data,
          likesCount: willLike ? (cached.data.likesCount ?? 0) + 1 : Math.max((cached.data.likesCount ?? 1) - 1, 0),
          isLikedByCurrentUser: willLike,
          isLiked: willLike
        };
        stickerSetCache.set(stickerSet.id, {
          ...cached,
          data: updatedData
        });
        // Обновляем отображаемые данные
        setFullStickerSet(updatedData);
      }
      
      if (onLike && willLike) onLike(stickerSet.id, stickerSet.title);
    } catch (error) {
      console.error('Ошибка при лайке:', error);
      // UI уже откатится автоматически в store при ошибке
    }
  };

  const handleShareClick = useCallback(() => {
    const targetUrl =
      fullStickerSet?.url ?? stickerSet.url ?? getStickerThumbnailUrl(stickers[activeIndex]?.file_id);

    if (!targetUrl) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Ссылка недоступна');
      }
      return;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, [activeIndex, fullStickerSet?.url, stickers, stickerSet.url]);

  // НЕ блокируем отображение - показываем оптимистичный UI сразу
  // Индикатор загрузки показываем только если данных совсем нет
  if (loading && !fullStickerSet) {
    return (
      <Box sx={{ 
        height: isModal ? 'auto' : '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 'var(--tg-spacing-4)'
      }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontSize: 'var(--tg-font-size-l)',
            color: 'var(--tg-theme-hint-color)'
          }}
        >
          Загрузка стикерсета...
        </Typography>
      </Box>
    );
  }

  // Показываем ошибку если не удалось загрузить
  if (error && !fullStickerSet) {
    return (
      <Box sx={{ 
        height: isModal ? 'auto' : '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 'var(--tg-spacing-4)',
        padding: 'var(--tg-spacing-4)'
      }}>
        <Typography 
          variant="h6" 
          color="error"
          sx={{ fontSize: 'var(--tg-font-size-l)' }}
        >
          {error}
        </Typography>
        <IconButton 
          onClick={onBack} 
          sx={{ 
            backgroundColor: 'primary.main', 
            color: 'white',
            borderRadius: 'var(--tg-radius-m)',
            width: 48,
            height: 48
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
    );
  }

  const handleOutsidePreviewClick = useCallback((event: React.MouseEvent) => {
    if (!isModal) return;
    
    // Проверяем, был ли клик вне области большого превью
    if (previewRef.current && !previewRef.current.contains(event.target as Node)) {
      onBack();
    }
  }, [isModal, onBack]);

  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Упрощенная логика: свайп вниз закрывает модальное окно
  useEffect(() => {
    if (!isModal) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;

      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      
      // Свайп вниз > 80px - закрываем модальное окно
      if (deltaY > 80) {
        e.preventDefault();
        e.stopPropagation();
        onBack();
        touchStartYRef.current = null;
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    // Добавляем обработчики на модальное окно, чтобы предотвратить всплытие
    const modalElement = modalContentRef.current;
    if (modalElement) {
      modalElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      modalElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      modalElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (modalElement) {
        modalElement.removeEventListener('touchstart', handleTouchStart);
        modalElement.removeEventListener('touchmove', handleTouchMove);
        modalElement.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isModal, onBack]);

  return (
    <Box 
      ref={modalContentRef}
      onClick={handleOutsidePreviewClick}
      sx={{ 
      height: isModal ? 'auto' : '100vh', 
      overflow: 'hidden', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: 'var(--tg-spacing-3)',
      padding: 'var(--tg-spacing-4)',
      backgroundColor: 'transparent', // Делаем фон полностью прозрачным
      touchAction: 'pan-y', // Разрешаем только вертикальный скролл
      animation: 'modalContentSlideIn 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      '@keyframes modalContentSlideIn': {
        '0%': {
          opacity: 0,
          transform: 'scale(0.95) translateY(20px)',
        },
        '100%': {
          opacity: 1,
          transform: 'scale(1) translateY(0)',
        },
      },
    }}>
      {/* Основной квадратный превью блок */}
      {stickerCount > 0 && (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Box 
            ref={previewRef}
            key={stickers[activeIndex]?.file_id || `preview-${activeIndex}`}
            onClick={(e) => e.stopPropagation()}
            sx={{
            position: 'relative',
            width: 'min(82vw, 44vh)',
            maxWidth: 480,
            aspectRatio: '1 / 1',
            borderRadius: 'var(--tg-radius-l)',
            border: '1px solid',
            borderColor: 'rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 'var(--tg-spacing-3)'
          }}>
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: stickerCount > 1 ? 'pointer' : 'default',
                touchAction: 'pan-y'
              }}
              onClick={(event) => {
                if (touchHandledRef.current) {
                  touchHandledRef.current = false;
                  return;
                }
                if (stickerCount <= 1) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                if (clickX < rect.width / 2) {
                  goToPrevSticker();
                } else {
                  goToNextSticker();
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
            >
              {!isMainLoaded && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.08)',
                    pointerEvents: 'none',
                    transition: 'opacity 120ms ease',
                    opacity: isMainLoaded ? 0 : 1
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      border: '3px solid rgba(255,255,255,0.35)',
                      borderTopColor: 'rgba(255,255,255,0.9)',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                </Box>
              )}
              {renderStickerMedia(stickers[activeIndex], {
                className: '',
                width: '100%',
                height: '100%',
                onLoad: () => setIsMainLoaded(true)
              })}
            </Box>
          </Box>
        </Box>
      )}

      {/* Нижняя горизонтальная лента */}
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <Box
          ref={scrollerRef}
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: 'min(92vw, 720px)',
            display: 'flex',
            gap: 'var(--tg-spacing-3)',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
            paddingX: 'var(--tg-spacing-3)',
            paddingY: 'var(--tg-spacing-3)',
            maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {stickers.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '100%',
              height: 128,
              color: 'text.secondary',
              padding: 'var(--tg-spacing-3)'
            }}>
              <Typography 
                variant="body2"
                sx={{ fontSize: 'var(--tg-font-size-s)' }}
              >
                Нет стикеров для отображения
              </Typography>
            </Box>
          ) : (
            stickers.map((s, idx) => {
              return (
                <LazyThumbnail
                  key={s.file_id}
                  sticker={s}
                  index={idx}
                  activeIndex={activeIndex}
                  onClick={handleStickerClick}
                />
              );
            })
          )}
        </Box>
      </Box>

      {/* Информация о наборе: полупрозрачная карточка как превью стикеров */}
      <Card 
        className="sticker-detail-info-card"
        onClick={(e) => e.stopPropagation()}
        sx={{ 
          width: 'min(92vw, 720px)', 
          marginTop: 'var(--tg-spacing-3)', 
          zIndex: 9999, // Очень высокий z-index
          position: 'relative',
          backgroundColor: 'rgba(0, 0, 0, 0.4) !important', // Увеличена прозрачность (было 0.6)
          border: '1px solid rgba(255, 255, 255, 0.2) !important', // Тонкая рамка как у превью
          borderRadius: 'var(--tg-radius-l)',
          backdropFilter: 'blur(6px)', // Blur как у превью стикеров
          WebkitBackdropFilter: 'blur(6px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)', // Мягкая тень
          // Переопределяем стили MUI для темного полупрозрачного фона
          '& .MuiCardContent-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.4) !important', // Увеличена прозрачность (было 0.6)
            padding: 'var(--tg-spacing-4)',
            color: 'white', // Белый текст для хорошей видимости
            '&:last-child': {
              paddingBottom: 'var(--tg-spacing-4)' // Убираем стандартный отступ MUI
            }
          }
        }}
      >
        <CardContent sx={{ 
          padding: 'var(--tg-spacing-4)',
          backgroundColor: 'rgba(0, 0, 0, 0.4) !important', // Увеличена прозрачность (было 0.6)
          color: 'white !important' // Белый цвет текста для контраста
        }}>
          <Typography
            variant="h5"
            sx={{
              textAlign: 'center',
              fontWeight: 700,
              color: 'white !important',
              fontSize: 'var(--tg-font-size-xxl)',
              textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)',
              marginBottom: 'var(--tg-spacing-2)'
            }}
          >
            {displayTitle}
          </Typography>
          {infoVariant === 'default' && authorUsername && stickerSet.authorId && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'calc(var(--tg-spacing-4) * 0.382)'
              }}
            >
              <Typography
                variant="body2"
                component={Link}
                to={`/author/${stickerSet.authorId}`}
                sx={{
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 'var(--tg-font-size-s)',
                  color: '#81d4fa',
                  '&:hover': {
                    color: '#b3e5fc'
                  }
                }}
              >
                {authorUsername}
              </Typography>
            </Box>
          )}
          {infoVariant === 'default' && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--tg-spacing-4)', marginTop: 'var(--tg-spacing-3)' }}>
              <IconButton
                aria-label="like"
                onClick={handleLikeClick}
                sx={{
                  width: 48,
                  height: 48,
                  backgroundColor: liked ? 'error.light' : 'rgba(255, 255, 255, 0.2)',
                  color: liked ? 'error.main' : 'white',
                  borderRadius: 'var(--tg-radius-l)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease',
                  transform: likeAnim ? 'scale(1.2)' : 'scale(1.0)',
                  '&:hover': {
                    backgroundColor: liked ? 'error.light' : 'rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.5)'
                  }
                }}
              >
                <FavoriteIcon />
              </IconButton>
              <Typography variant="body2" sx={{
                minWidth: 24,
                textAlign: 'center',
                color: 'white !important',
                fontWeight: 600,
                fontSize: 'var(--tg-font-size-m)',
                textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.7)'
              }}>
                {likes}
              </Typography>
              <IconButton
                aria-label="share"
                onClick={handleShareClick}
                sx={{
                  width: 44,
                  height: 44,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: 'var(--tg-radius-l)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    transform: 'scale(1.05)'
                  }
                }}
              >
                <DownloadIcon />
              </IconButton>
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--tg-spacing-3)',
              marginTop: 'var(--tg-spacing-3)',
              flexWrap: 'wrap'
            }}
          >
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: 'var(--tg-spacing-3)',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
                minHeight: 44
              }}
            >
              {displayedCategories.length > 0 ? (
                displayedCategories.map((category) => (
                  <Box
                    key={category.id}
                    sx={{
                      flexShrink: 0,
                      padding: '4px 12px',
                      borderRadius: '13px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      color: 'white !important',
                      fontSize: '14px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                    }}
                  >
                    {category.name}
                  </Box>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Категории не назначены
                </Typography>
              )}
            </Box>
            {(canEditCategories || (effectiveStickerSet.availableActions && effectiveStickerSet.availableActions.length > 0)) && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--tg-spacing-2)',
                  flexShrink: 0
                }}
              >
            {canEditCategories && (
              <Button
                variant="contained"
                size="small"
                onClick={handleOpenCategoriesDialog}
                sx={{
                      whiteSpace: 'nowrap'
                }}
              >
                Изменить
              </Button>
                )}
                {/* Динамические кнопки действий на основе availableActions */}
                {effectiveStickerSet.availableActions && effectiveStickerSet.availableActions.length > 0 && (
                  <StickerSetActions
                    stickerSet={effectiveStickerSet}
                    availableActions={effectiveStickerSet.availableActions}
                    onActionComplete={handleActionComplete}
                  />
                )}
              </Box>
            )}
          </Box>
          {isStickerSetBlocked && (
            <Alert
              severity="error"
              variant="outlined"
              sx={{
                mt: 2,
                color: 'rgba(255, 255, 255, 0.9)',
                borderColor: 'rgba(244, 67, 54, 0.4)',
                backgroundColor: 'rgba(244, 67, 54, 0.12)'
              }}
            >
              Набор заблокирован {currentBlockReason ? `— ${currentBlockReason}` : 'без указания причины'}.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCategoriesDialogOpen}
        onClose={handleCloseCategoriesDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          onClick: (e) => e.stopPropagation(),
          sx: {
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            backgroundImage: 'none'
          }
        }}
        BackdropProps={{
          onClick: (e) => {
            e.stopPropagation();
            handleCloseCategoriesDialog();
          }
        }}
      >
        <DialogTitle 
          component="div"
          sx={{ 
            pb: 2,
            color: 'var(--tg-theme-text-color, #000000)',
            fontSize: '1.25rem',
            fontWeight: 600
          }}
        >
          Добавьте категории
        </DialogTitle>
        <DialogContent 
          dividers 
          onClick={(e) => e.stopPropagation()}
          sx={{
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            borderColor: 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))'
          }}
        >
          {categorySaveError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {categorySaveError}
            </Alert>
          )}

          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--tg-theme-text-color, #000000)', mb: 1 }}>
            Доступные категории
          </Typography>
          {categoriesLoading && availableCategories.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CircularProgress size={18} sx={{ color: 'var(--tg-theme-button-color, #2481cc)' }} />
              <Typography variant="body2" sx={{ color: 'var(--tg-theme-text-color, #000000)' }}>Загрузка категорий…</Typography>
            </Box>
          ) : categoriesLoadError ? (
            <Alert severity="error" sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span>{categoriesLoadError}</span>
              <Button variant="outlined" size="small" onClick={loadCategories}>
                Повторить загрузку
              </Button>
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 2 }}>
              {availableCategories.map((category) => {
                const isSelected = selectedCategoryKeys.includes(category.key);
                return (
                  <Chip
                    key={category.key}
                    label={category.name}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => handleToggleCategory(category.key)}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              })}
            </Box>
          )}

          <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color, #999999)' }}>
            Выбрано категорий: {selectedCategoryKeys.length}
          </Typography>
        </DialogContent>
        <DialogActions 
          onClick={(e) => e.stopPropagation()}
          sx={{
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            borderColor: 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))'
          }}
        >
          <Button 
            onClick={handleCloseCategoriesDialog} 
            disabled={isSavingCategories}
            sx={{
              color: 'var(--tg-theme-button-color, #2481cc)'
            }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSaveCategories}
            variant="contained"
            disabled={isSavingCategories}
            sx={{
              backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
              color: 'var(--tg-theme-button-text-color, #ffffff)',
              '&:hover': {
                backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                opacity: 0.9
              }
            }}
          >
            {isSavingCategories ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isBlockDialogOpen}
        onClose={handleCloseBlockDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          onClick: (e) => e.stopPropagation(),
          sx: {
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            backgroundImage: 'none'
          }
        }}
        BackdropProps={{
          onClick: (e) => {
            e.stopPropagation();
            handleCloseBlockDialog();
          }
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            pb: 2,
            color: 'var(--tg-theme-text-color, #000000)',
            fontSize: '1.25rem',
            fontWeight: 600
          }}
        >
          Заблокировать стикерсет
        </DialogTitle>
        <DialogContent
          dividers
          onClick={(e) => e.stopPropagation()}
          sx={{
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            borderColor: 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {blockError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {blockError}
            </Alert>
          )}
          <Typography variant="body2" sx={{ color: 'var(--tg-theme-text-color, #000000)' }}>
            Стикерсет будет скрыт из галереи для всех пользователей. Укажите причину блокировки
            (опционально), чтобы авторам было понятно, что нужно исправить.
          </Typography>
          <TextField
            label="Причина блокировки"
            placeholder="Например: Нарушение авторских прав"
            multiline
            minRows={3}
            value={blockReasonInput}
            onChange={(event) => setBlockReasonInput(event.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions
          onClick={(e) => e.stopPropagation()}
          sx={{
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            borderColor: 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))'
          }}
        >
          <Button onClick={handleCloseBlockDialog} disabled={isBlocking}>
            Отмена
          </Button>
          <Button
            onClick={handleBlockStickerSet}
            variant="contained"
            color="error"
            disabled={isBlocking}
          >
            {isBlocking ? 'Блокируем…' : 'Заблокировать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
