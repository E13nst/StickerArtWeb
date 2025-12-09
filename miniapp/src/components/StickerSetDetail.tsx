import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  SvgIcon
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { StickerSetResponse, CategoryResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { getStickerThumbnailUrl, getStickerImageUrl } from '@/utils/stickerUtils';
import { StickerThumbnail } from './StickerThumbnail';
import { useLikesStore } from '@/store/useLikesStore';
import { prefetchSticker, getCachedStickerUrl, imageCache, LoadPriority, imageLoader } from '@/utils/imageLoader';
import { useTelegram } from '@/hooks/useTelegram';
import { Link } from 'react-router-dom';
import { useProfileStore } from '@/store/useProfileStore';
import { useStickerStore } from '@/store/useStickerStore';
import { StickerSetActions } from './StickerSetActions';
import type { SvgIconProps } from '@mui/material/SvgIcon';
// Новые модули
import { useStickerSetData } from '@/hooks/useStickerSetData';
import { useStickerNavigation } from '@/hooks/useStickerNavigation';
import { CategoriesDialog, BlockDialog, StickerPreview, StickerSetActionsBar, StickerSetDetailEdit } from './StickerSetDetail/index';
import { StickerSetEditOperations } from '@/types/sticker';


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
        width: 72,
        height: 72,
        minWidth: 72,
        minHeight: 72,
        borderRadius: 'var(--tg-radius-m)',
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : 'var(--tg-theme-border-color)',
        backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 0, 0, 0), 0.6)',
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
            size={72}
          />
          {sticker.emoji && (
            <Box sx={{
              position: 'absolute',
              bottom: '3px',
              left: '3px',
              color: 'var(--tg-theme-text-color)',
              fontSize: '14px',
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
  // Используем новые хуки для управления данными и навигацией
  const preloadLargeStickers = useCallback(async (stickers: any[]) => {
    if (!isModal) return;
    const isLargeStickerSet = stickers.length > 50;
    
    if (isLargeStickerSet) {
      const stickersToPreload = stickers.slice(0, 3);
      if (stickersToPreload.length === 0) return;
      
      const batchPromises = stickersToPreload.map((sticker, index) => {
        const imageUrl = getStickerImageUrl(sticker.file_id);
        const priority = index === 0 
          ? LoadPriority.TIER_0_MODAL 
          : LoadPriority.TIER_1_VIEWPORT;
        
        return prefetchSticker(sticker.file_id, imageUrl, {
          isAnimated: Boolean(sticker.is_animated || sticker.isAnimated),
          isVideo: Boolean(sticker.is_video || sticker.isVideo),
          markForGallery: true,
          priority
        }).catch(() => {});
      });
      
      await Promise.allSettled(batchPromises);
    } else {
      const stickersToPreload = stickers.slice(0, 10);
      if (stickersToPreload.length === 0) return;
      
      const batchSize = 2;
      const batchInterval = 300;
      
      for (let i = 0; i < stickersToPreload.length; i += batchSize) {
        const batch = stickersToPreload.slice(i, i + batchSize);
        const priority = i === 0 
          ? LoadPriority.TIER_0_MODAL 
          : LoadPriority.TIER_2_NEAR_VIEWPORT;
        
        const batchPromises = batch.map((sticker) => {
          const imageUrl = getStickerImageUrl(sticker.file_id);
          return prefetchSticker(sticker.file_id, imageUrl, {
            isAnimated: Boolean(sticker.is_animated || sticker.isAnimated),
            isVideo: Boolean(sticker.is_video || sticker.isVideo),
            markForGallery: true,
            priority
          }).catch(() => {});
        });
        
        await Promise.allSettled(batchPromises);
        
        if (i + batchSize < stickersToPreload.length) {
          await new Promise(resolve => setTimeout(resolve, batchInterval));
        }
      }
    }
  }, [isModal]);

  const {
    fullStickerSet,
    effectiveStickerSet,
    stickers,
    loading,
    error,
    updateStickerSet
  } = useStickerSetData({ 
    stickerSet, 
    preloadStickers: preloadLargeStickers 
  });

  const stickerCount = stickers.length;
  const {
    activeIndex,
    setActiveIndex,
    currentStickerLoading,
    setCurrentStickerLoading,
    isMainLoaded,
    setIsMainLoaded,
    goToNextSticker,
    goToPrevSticker,
    handleStickerClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    touchHandledRef,
    scrollerRef,
    previewRef
  } = useStickerNavigation({ stickerCount, isModal });

  const [likeAnim, setLikeAnim] = useState(false);
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const [isCategoriesDialogOpen, setIsCategoriesDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [starsInfoAnchor, setStarsInfoAnchor] = useState<HTMLElement | null>(null);
  
  // Режим просмотра/редактирования (только для автора)
  // mode может быть установлен в 'edit' только если isAuthor === true
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  
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
  // ИЛИ
  // 3. В availableActions присутствует EDIT_CATEGORIES (бэкенд проверил права)
  const canEditCategories = 
    (enableCategoryEditing && (isAuthor || isAdmin)) || 
    (effectiveStickerSet.availableActions?.includes('EDIT_CATEGORIES') ?? false);

  // Отладочный лог для проверки прав редактирования категорий
  console.log('🏷️ Права редактирования категорий:', {
    stickerSetId: effectiveStickerSet.id,
    canEditCategories,
    enableCategoryEditing,
    isAuthor,
    isAdmin,
    hasEditCategoriesAction: effectiveStickerSet.availableActions?.includes('EDIT_CATEGORIES'),
    availableActions: effectiveStickerSet.availableActions
  });

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

  
  // Загружаем текущий стикер и prefetch соседних при изменении activeIndex
  useEffect(() => {
    if (!isModal) return;
    const currentSticker = stickers[activeIndex];
    if (!currentSticker?.file_id) {
      setCurrentStickerLoading(false);
      return;
    }
    
    // Проверяем не загружен ли уже текущий стикер в кеше
    const cachedUrl = getCachedStickerUrl(currentSticker.file_id);
    const imageUrl = getStickerImageUrl(currentSticker.file_id);
    
    if (cachedUrl) {
      // Уже в кеше - не нужно загружать
      setCurrentStickerLoading(false);
      return;
    }
    
    // ✅ КРИТИЧНО: Загружаем напрямую с максимальным приоритетом, а не через prefetch
    // Prefetch не гарантирует немедленную загрузку, а нам нужно показать стикер СЕЙЧАС
    setCurrentStickerLoading(true);
    
    // 🔍 ДИАГНОСТИКА: Логируем данные стикера для отладки
    const isAnimated = currentSticker.is_animated || currentSticker.isAnimated;
    const isVideo = currentSticker.is_video || currentSticker.isVideo;
    console.log(`🔍 [StickerSetDetail] Стикер ${activeIndex}: file_id=${currentSticker.file_id.slice(-8)}, is_animated=${currentSticker.is_animated}, isAnimated=${currentSticker.isAnimated}, is_video=${currentSticker.is_video}, isVideo=${currentSticker.isVideo}`);
    
    const loadPromise = isAnimated
      ? imageLoader.loadAnimation(currentSticker.file_id, imageUrl, LoadPriority.TIER_0_MODAL)
      : isVideo
      ? imageLoader.loadVideo(currentSticker.file_id, imageUrl, LoadPriority.TIER_0_MODAL)
      : imageLoader.loadImage(currentSticker.file_id, imageUrl, LoadPriority.TIER_0_MODAL);
    
    loadPromise
      .then(() => {
        setCurrentStickerLoading(false);
      })
      .catch(() => {
        setCurrentStickerLoading(false);
        // Игнорируем ошибки - fallback обработает
      });
    
    // Prefetch следующий стикер с более низким приоритетом (для плавной прокрутки)
    const nextIndex = activeIndex + 1;
    if (nextIndex < stickers.length) {
      const nextSticker = stickers[nextIndex];
      if (nextSticker?.file_id) {
        const nextCachedUrl = getCachedStickerUrl(nextSticker.file_id);
        if (!nextCachedUrl) {
          prefetchSticker(nextSticker.file_id, getStickerImageUrl(nextSticker.file_id), {
            isAnimated: Boolean(nextSticker.is_animated || nextSticker.isAnimated),
            isVideo: Boolean(nextSticker.is_video || nextSticker.isVideo),
            markForGallery: true,
            priority: LoadPriority.TIER_2_NEAR_VIEWPORT // Более низкий приоритет для prefetch
          }).catch(() => {});
        }
      }
    }
    
    // Prefetch предыдущий стикер (если пользователь вернется назад)
    const prevIndex = activeIndex - 1;
    if (prevIndex >= 0) {
      const prevSticker = stickers[prevIndex];
      if (prevSticker?.file_id) {
        const prevCachedUrl = getCachedStickerUrl(prevSticker.file_id);
        if (!prevCachedUrl) {
          prefetchSticker(prevSticker.file_id, getStickerImageUrl(prevSticker.file_id), {
            isAnimated: Boolean(prevSticker.is_animated || prevSticker.isAnimated),
            isVideo: Boolean(prevSticker.is_video || prevSticker.isVideo),
            markForGallery: true,
            priority: LoadPriority.TIER_3_ADDITIONAL // Низкий приоритет для обратной навигации
          }).catch(() => {});
        }
      }
    }
  }, [activeIndex, stickers, isModal]);

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


  const handleOpenCategoriesDialog = useCallback(() => {
    setIsCategoriesDialogOpen(true);
  }, []);

  const handleCloseCategoriesDialog = useCallback(() => {
    setIsCategoriesDialogOpen(false);
  }, []);

  const handleSaveCategories = useCallback((updated: StickerSetResponse) => {
    updateStickerSet(updated);
    onCategoriesUpdated?.(updated);
  }, [updateStickerSet, onCategoriesUpdated]);

  const handleOpenBlockDialog = useCallback(() => {
    setIsBlockDialogOpen(true);
  }, []);

  const handleCloseBlockDialog = useCallback(() => {
    setIsBlockDialogOpen(false);
  }, []);

  const handleBlockStickerSet = useCallback((updated: StickerSetResponse) => {
    updateStickerSet(updated);
    onStickerSetUpdated?.(updated);
  }, [updateStickerSet, onStickerSetUpdated]);

  // Обработчики для режима редактирования
  const handleEditCancel = useCallback(() => {
    setMode('view');
  }, []);

  const handleEditDone = useCallback((ops: StickerSetEditOperations) => {
    // В Фазе 1: только логируем, не вызываем API
    console.log('Изменения (не сохраняются):', ops);
    setMode('view');
  }, []);

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
      updateStickerSet(mergedUpdate);

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
      updateStickerSet(
        effectiveStickerSet ? applyVisibilityToStickerSet(effectiveStickerSet, next) : applyVisibilityToStickerSet(stickerSet, next)
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

        updateStickerSet(finalData);
        setDraftVisibility(finalVisibilityState);

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
        updateStickerSet(previousFull ?? stickerSet);
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
      
      // Обновляем данные при изменении лайков
      if (fullStickerSet) {
        const updatedData = {
          ...fullStickerSet,
          likesCount: willLike ? (fullStickerSet.likesCount ?? 0) + 1 : Math.max((fullStickerSet.likesCount ?? 1) - 1, 0),
          isLikedByCurrentUser: willLike,
          isLiked: willLike
        };
        updateStickerSet(updatedData);
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
            color: 'var(--tg-theme-button-text-color)',
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
    
    const target = event.target as HTMLElement;
    
    // Не закрываем, если Popover открыт - проверяем классы MUI Popover
    if (starsInfoAnchor) {
      // Проверяем, был ли клик внутри Popover или на его backdrop
      const isPopoverElement = target.closest('.MuiPopover-root') || 
                               target.closest('[role="presentation"]') ||
                               target.classList.contains('MuiPopover-root') ||
                               target.classList.contains('MuiPaper-root');
      if (isPopoverElement) {
        return;
      }
    }
    
    // Не закрываем, если клик внутри Popover через ref
    if (starsPopoverRef.current && starsPopoverRef.current.contains(target)) {
      return;
    }
    
    // Проверяем, был ли клик вне области большого превью
    if (previewRef.current && !previewRef.current.contains(target)) {
      onBack();
    }
  }, [isModal, onBack, starsInfoAnchor]);

  // Обработчик клика выше модального окна (в backdrop области)
  useEffect(() => {
    if (!isModal) return;

    const handleBackdropClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Не закрываем, если Popover открыт
      if (starsInfoAnchor) {
        const isPopoverElement = target.closest('.MuiPopover-root') || 
                                 target.closest('[role="presentation"]') ||
                                 target.classList.contains('MuiPopover-root') ||
                                 target.classList.contains('MuiPaper-root');
        if (isPopoverElement) {
          return;
        }
      }
      
      // Проверяем, был ли клик выше модального окна
      if (modalContentRef.current) {
        const modalRect = modalContentRef.current.getBoundingClientRect();
        const clickY = event.clientY;
        
        // Если клик выше модального окна (выше его верхней границы)
        if (clickY < modalRect.top) {
          onBack();
        }
      }
    };

    document.addEventListener('mousedown', handleBackdropClick);
    
    return () => {
      document.removeEventListener('mousedown', handleBackdropClick);
    };
  }, [isModal, onBack, starsInfoAnchor]);

  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const starsPopoverRef = useRef<HTMLDivElement | null>(null);

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

  // Условный рендеринг: edit-режим или view-режим
  if (mode === 'edit' && isAuthor) {
    return (
      <Box 
        ref={modalContentRef}
        data-modal-content
        sx={{
          position: isModal ? 'fixed' : 'relative',
          top: isModal ? 'auto' : 'auto',
          left: isModal ? 0 : 'auto',
          right: isModal ? 0 : 'auto',
          bottom: isModal ? 0 : 'auto',
          width: '100%',
          height: isModal ? 'auto' : '100vh',
          maxHeight: isModal ? '100vh' : 'none',
          minHeight: isModal ? 'auto' : 'none',
          overflow: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '8px',
          paddingTop: '5px',
          backgroundColor: isModal ? 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.75)' : 'transparent',
          backdropFilter: isModal ? 'blur(15px)' : 'none',
          WebkitBackdropFilter: isModal ? 'blur(15px)' : 'none',
          borderTopLeftRadius: isModal ? '24px' : 0,
          borderTopRightRadius: isModal ? '24px' : 0,
          touchAction: 'pan-y',
          zIndex: isModal ? 'var(--z-modal, 1000)' : 'auto',
          animation: isModal ? 'modalSlideUpFromBottom 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'modalContentSlideIn 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          '@keyframes modalSlideUpFromBottom': {
            '0%': {
              opacity: 0,
              transform: 'translateY(100%)',
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
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
        }}
      >
        <StickerSetDetailEdit
          stickerSet={fullStickerSet ?? stickerSet}
          onCancel={handleEditCancel}
          onDone={handleEditDone}
        />
      </Box>
    );
  }

  // View-режим (обычный режим просмотра)
  return (
    <Box 
      ref={modalContentRef}
      data-modal-content
      onClick={handleOutsidePreviewClick}
      sx={{ 
      position: isModal ? 'fixed' : 'relative',
      top: isModal ? 'auto' : 'auto',
      left: isModal ? 0 : 'auto',
      right: isModal ? 0 : 'auto',
      bottom: isModal ? 0 : 'auto',
      width: '100%',
      height: isModal ? 'auto' : '100vh',
      maxHeight: isModal ? '100vh' : 'none', // Перекрывает весь экран, включая навигацию
      minHeight: isModal ? 'auto' : 'none',
      overflow: 'hidden', 
      overflowY: 'hidden',
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'flex-start',
      gap: '5px',
      padding: '8px',
      paddingTop: '5px',
      backgroundColor: isModal ? 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.75)' : 'transparent',
      backdropFilter: isModal ? 'blur(15px)' : 'none',
      WebkitBackdropFilter: isModal ? 'blur(15px)' : 'none',
      borderTopLeftRadius: isModal ? '24px' : 0,
      borderTopRightRadius: isModal ? '24px' : 0,
      touchAction: 'pan-y',
      zIndex: isModal ? 'var(--z-modal, 1000)' : 'auto', // Modal content: same layer as modal backdrop
      animation: isModal ? 'modalSlideUpFromBottom 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'modalContentSlideIn 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      '@keyframes modalSlideUpFromBottom': {
        '0%': {
          opacity: 0,
          transform: 'translateY(100%)',
        },
        '100%': {
          opacity: 1,
          transform: 'translateY(0)',
        },
      },
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
      {/* Grab handle для свайпа */}
      {isModal && (
        <Box
          sx={{
            width: '34px',
            height: '3px',
            backgroundColor: 'var(--tg-theme-hint-color)',
            opacity: 0.4,
            borderRadius: '2px',
            marginTop: '3px',
            marginBottom: '3px',
            flexShrink: 0,
          }}
        />
      )}
      
      {/* Название и автор вверху */}
      <Box sx={{ 
        width: '92vw',
        maxWidth: '450px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        paddingTop: '8px',
        marginBottom: '13px'
      }}>
        <Typography
          variant="h5"
          sx={{
            textAlign: 'center',
            fontWeight: 700,
            color: 'var(--tg-theme-text-color) !important',
            fontSize: '21px',
            lineHeight: '1.2',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 2px 6px var(--tg-theme-shadow-color), 0 1px 3px var(--tg-theme-shadow-color)',
          }}
        >
          {displayTitle}
        </Typography>
        {infoVariant === 'default' && authorUsername && stickerSet.authorId && (
          <Typography
            variant="body2"
            component={Link}
            to={`/author/${stickerSet.authorId}`}
            sx={{
              textAlign: 'center',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--tg-theme-link-color)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              '&:hover': {
                opacity: 0.8
              }
            }}
          >
            {authorUsername}
          </Typography>
        )}
      </Box>
      {/* Основной блок: превью слева, кнопки справа */}
      {stickerCount > 0 && (
        <Box sx={{ 
          width: '92vw',
          maxWidth: '450px',
          margin: '0 auto',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          gap: '13px'
        }}>
          {/* Левая часть: большое превью */}
          <StickerPreview
            sticker={stickers[activeIndex]}
            stickerCount={stickerCount}
            isMainLoaded={isMainLoaded}
            onLoad={() => setIsMainLoaded(true)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            onClick={(event) => {
              if (stickerCount <= 1) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const clickX = event.clientX - rect.left;
              if (clickX < rect.width / 2) {
                goToPrevSticker();
              } else {
                goToNextSticker();
              }
            }}
            touchHandled={touchHandledRef}
            previewRef={previewRef}
          />
          
          {/* Правая часть: вертикальный столбец кнопок на всю высоту превью */}
          <StickerSetActionsBar
            liked={liked}
            likes={likes}
            likeAnim={likeAnim}
            onLikeClick={handleLikeClick}
            onShareClick={handleShareClick}
            starsInfoAnchor={starsInfoAnchor}
            onStarsInfoOpen={(anchor) => setStarsInfoAnchor(anchor)}
            onStarsInfoClose={() => setStarsInfoAnchor(null)}
          />
        </Box>
      )}

      {/* Нижняя горизонтальная лента */}
      <Box sx={{ 
        width: '92vw',
        maxWidth: '450px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'flex-start'
      }}>
        <Box
          ref={scrollerRef}
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: '100%',
            display: 'flex',
            gap: '5px',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
            paddingX: '5px',
            paddingY: '5px',
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
              height: 72,
              color: 'text.secondary',
              padding: '5px'
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
      <Box 
        className="sticker-detail-info-card"
        onClick={(e) => e.stopPropagation()}
        sx={{ 
          width: '92vw',
          maxWidth: '450px',
          margin: '0 auto',
          zIndex: 9999, // Очень высокий z-index
          position: 'relative'
        }}
      >
          {/* Только категории и кнопки управления */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '5px',
              flexWrap: 'nowrap',
              width: '100%',
              padding: '8px',
              // На очень маленьких экранах уменьшаем отступы
              '@media (max-width: 400px)': {
                padding: '6px',
                gap: '4px'
              },
              '@media (max-width: 350px)': {
                padding: '4px',
                gap: '3px'
              }
            }}
          >
            <Box
              sx={{
                flexGrow: 1,
                flexShrink: 1,
                minWidth: 0, // Важно для корректной работы flexbox
                display: 'flex',
                gap: '5px',
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '5px 2px',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
                alignItems: 'center', // Выравнивание по центру для адаптивности
                // На маленьких экранах уменьшаем отступы
                '@media (max-width: 400px)': {
                  gap: '4px',
                  padding: '4px 2px'
                }
              }}
            >
              {displayedCategories.length > 0 ? (
                displayedCategories.map((category) => (
                  <Box
                    key={category.id}
                    sx={{
                      flexShrink: 0,
                      padding: '6px 12px',
                      borderRadius: '13px',
                      backgroundColor: 'rgba(var(--tg-theme-text-color-rgb, 255, 255, 255), 0.15)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      color: 'var(--tg-theme-text-color) !important',
                      fontSize: '13px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      border: '1px solid rgba(var(--tg-theme-text-color-rgb, 255, 255, 255), 0.25)',
                      textShadow: '0 1px 3px var(--tg-theme-shadow-color)',
                      maxWidth: '140px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'all 150ms ease',
                      '&:hover': {
                        backgroundColor: 'rgba(var(--tg-theme-text-color-rgb, 255, 255, 255), 0.2)',
                        border: '1px solid rgba(var(--tg-theme-text-color-rgb, 255, 255, 255), 0.35)',
                        transform: 'scale(1.02)'
                      },
                      // Адаптивность для маленьких экранов
                      '@media (max-width: 400px)': {
                        padding: '5px 10px',
                        fontSize: '12px',
                        maxWidth: '110px',
                        borderRadius: '10px'
                      },
                      // Для очень маленьких экранов
                      '@media (max-width: 350px)': {
                        padding: '4px 8px',
                        fontSize: '11px',
                        maxWidth: '90px',
                        borderRadius: '8px'
                      }
                    }}
                  >
                    {category.name}
                  </Box>
                ))
              ) : (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'var(--tg-theme-hint-color)', 
                    fontWeight: 500,
                    '@media (max-width: 400px)': {
                      fontSize: '12px'
                    }
                  }}
                >
                  Категории не назначены
                </Typography>
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
                '@media (max-width: 400px)': {
                  gap: '4px'
                }
              }}
            >
              {/* Кнопка "Изменить" (только для автора, только в режиме view) */}
              {isAuthor && mode === 'view' && (
                <IconButton
                  onClick={() => {
                    if (isAuthor) {
                      setMode('edit');
                    }
                  }}
                  sx={{
                    width: 32,
                    height: 32,
                    minWidth: 28,
                    minHeight: 28,
                    backgroundColor: 'transparent',
                    color: 'var(--tg-theme-link-color)',
                    padding: '4px',
                    transition: 'all 150ms ease',
                    flexShrink: 0,
                    '&:hover': {
                      backgroundColor: 'rgba(var(--tg-theme-link-color-rgb, 36, 129, 204), 0.1)',
                      color: 'var(--tg-theme-link-color)'
                    },
                    '&:active': {
                      backgroundColor: 'rgba(var(--tg-theme-link-color-rgb, 36, 129, 204), 0.15)'
                    },
                    '@media (max-width: 400px)': {
                      width: 28,
                      height: 28,
                      '& svg': {
                        fontSize: '16px'
                      }
                    },
                    '@media (max-width: 350px)': {
                      width: 24,
                      height: 24,
                      '& svg': {
                        fontSize: '14px'
                      }
                    }
                  }}
                  title="Изменить стикерсет"
                >
                  <EditIcon sx={{ fontSize: '18px' }} />
                </IconButton>
              )}
              {/* Кнопка редактирования категорий */}
              {canEditCategories && (
                <IconButton
                  onClick={handleOpenCategoriesDialog}
                  sx={{
                    width: 32,
                    height: 32,
                    minWidth: 28, // Минимальный размер для кликабельности
                    minHeight: 28,
                    backgroundColor: 'transparent',
                    color: 'var(--tg-theme-hint-color)',
                    padding: '4px',
                    transition: 'all 150ms ease',
                    flexShrink: 0, // Не сжимается
                    '&:hover': {
                      backgroundColor: 'rgba(var(--tg-theme-text-color-rgb, 255, 255, 255), 0.1)',
                      color: 'var(--tg-theme-text-color)'
                    },
                    '&:active': {
                      backgroundColor: 'rgba(var(--tg-theme-text-color-rgb, 255, 255, 255), 0.15)'
                    },
                    // Адаптивность для маленьких экранов
                    '@media (max-width: 400px)': {
                      width: 28,
                      height: 28,
                      '& svg': {
                        fontSize: '16px'
                      }
                    },
                    '@media (max-width: 350px)': {
                      width: 24,
                      height: 24,
                      '& svg': {
                        fontSize: '14px'
                      }
                    }
                  }}
                  title="Изменить категории"
                >
                  <EditIcon sx={{ fontSize: '18px' }} />
                </IconButton>
              )}
            </Box>
          </Box>
          {/* Минималистичная горизонтальная черта под категориями */}
          <Box
            sx={{
              width: '100%',
              height: '1px',
              backgroundColor: 'var(--tg-theme-border-color)',
              marginTop: '8px',
              marginBottom: '8px'
            }}
          />
          {isStickerSetBlocked && (
            <Alert
              severity="error"
              variant="outlined"
              sx={{
                mt: 2,
                mx: '8px',
                color: 'var(--tg-theme-text-color)',
                borderColor: 'var(--tg-theme-error-color)',
                backgroundColor: 'rgba(var(--tg-theme-error-color-rgb, 244, 67, 54), 0.12)'
              }}
            >
              Набор заблокирован {currentBlockReason ? `— ${currentBlockReason}` : 'без указания причины'}.
            </Alert>
          )}

          {/* Кнопки действий внизу модального окна */}
          {effectiveStickerSet.availableActions && effectiveStickerSet.availableActions.length > 0 && (
            <Box
              sx={{
                mt: 2,
                px: '8px',
                pb: '8px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2
              }}
            >
              <StickerSetActions
                stickerSet={effectiveStickerSet}
                availableActions={effectiveStickerSet.availableActions}
                onActionComplete={handleActionComplete}
              />
            </Box>
          )}
      </Box>

      <CategoriesDialog
        open={isCategoriesDialogOpen}
        onClose={handleCloseCategoriesDialog}
        stickerSetId={stickerSet.id}
        currentCategoryKeys={currentCategoryKeys}
        onSave={handleSaveCategories}
        fullStickerSet={fullStickerSet}
        stickerSet={stickerSet}
      />
      
      <BlockDialog
        open={isBlockDialogOpen}
        onClose={handleCloseBlockDialog}
        stickerSetId={effectiveStickerSet?.id || stickerSet.id}
        onBlock={handleBlockStickerSet}
        fullStickerSet={fullStickerSet}
        stickerSet={stickerSet}
      />
    </Box>
  );
};

