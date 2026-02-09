import { useEffect, useRef, useState, useCallback, memo, useMemo, FC, MouseEvent } from 'react';
import { CloseIcon } from '@/components/ui/Icons';
import { EditIcon } from '@/components/ui/Icons';
import { Text } from '@/components/ui/Text';
import { StickerSetResponse } from '@/types/sticker';
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
// Новые модули
import { useStickerSetData } from '@/hooks/useStickerSetData';
import { useStickerNavigation } from '@/hooks/useStickerNavigation';
import { CategoriesDialog, BlockDialog, StickerPreview, StickerSetActionsBar, StickerSetDetailEdit } from './StickerSetDetail/index';
import { StickerSetEditOperations } from '@/types/sticker';
import { DonateModal } from './DonateModal';
import './StickerSetDetail.css';

// Компонент для ленивой загрузки миниатюр
interface LazyThumbnailProps {
  sticker: any;
  index: number;
  activeIndex: number;
  onClick: (idx: number) => void;
}

const LazyThumbnail: FC<LazyThumbnailProps> = memo(({
  sticker,
  index,
  activeIndex,
  onClick
}) => {
  const isActive = index === activeIndex;

  return (
    <div
      data-thumbnail-index={index}
      data-active={isActive}
      onClick={() => onClick(index)}
      style={{
        flex: '0 0 auto',
        width: 72,
        height: 72,
        minWidth: 72,
        minHeight: 72,
        borderRadius: 'var(--tg-radius-m)',
        border: '1px solid',
        borderColor: isActive ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-border-color)',
        backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 0, 0, 0), 0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 120ms ease, border-color 120ms ease, background-color 200ms ease',
        // '&:active': { transform: 'scale(0.98)' },
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
            <div style={{
              position: 'absolute',
              bottom: '3px',
              left: '3px',
              color: 'var(--tg-theme-text-color)',
              fontSize: '14px',
              textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 3px 6px rgba(0,0,0,0.35)'
            }}>
              {sticker.emoji}
        </div>
      )}
    </div>
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

export const StickerSetDetail: FC<StickerSetDetailProps> = ({
  stickerSet,
  onBack,
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
      // Для больших сетов: загружаем только первые 3
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
      // ✅ FIX: Для небольших сетов - загружаем только 5 первых стикеров (вместо 10)
      // Убираем задержки между батчами для более быстрой загрузки
      const stickersToPreload = stickers.slice(0, 5);
      if (stickersToPreload.length === 0) return;
      
      const batchSize = 3; // Увеличили с 2 до 3 для более быстрой загрузки
      
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
        // ✅ FIX: Убрали задержки между батчами - загружаем максимально быстро
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
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);
  
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
  
  const isStickerSetBlocked = Boolean(effectiveStickerSet?.isBlocked);
  const currentBlockReason = effectiveStickerSet?.blockReason;
  const displayedCategories = useMemo(() => {
    return effectiveStickerSet?.categories ?? stickerSet.categories ?? [];
  }, [effectiveStickerSet?.categories, stickerSet.categories]);
  const currentCategoryKeys = useMemo(() => {
    return displayedCategories
      .map((category: any) => category?.key)
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

  // Используем глобальный store для лайков с селекторами для автоматического обновления
  const { isLiked: liked, likesCount: likes } = useLikesStore((state) => 
    state.likes[stickerSet.id.toString()] || { 
      packId: stickerSet.id.toString(), 
      isLiked: false, 
      likesCount: 0 
    }
  );
  const toggleLike = useLikesStore((state) => state.toggleLike);
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
    const isAnimated = currentSticker.is_animated || (currentSticker as any).isAnimated;
    const isVideo = currentSticker.is_video || (currentSticker as any).isVideo;
    console.log(`🔍 [StickerSetDetail] Стикер ${activeIndex}: file_id=${currentSticker.file_id.slice(-8)}, is_animated=${currentSticker.is_animated}, isAnimated=${(currentSticker as any).isAnimated}, is_video=${currentSticker.is_video}, isVideo=${(currentSticker as any).isVideo}`);
    
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
            isAnimated: Boolean(nextSticker.is_animated || (nextSticker as any).isAnimated),
            isVideo: Boolean(nextSticker.is_video || (nextSticker as any).isVideo),
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
            isAnimated: Boolean(prevSticker.is_animated || (prevSticker as any).isAnimated),
            isVideo: Boolean(prevSticker.is_video || (prevSticker as any).isVideo),
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
      !Boolean(currentSticker.is_animated || (currentSticker as any).isAnimated) &&
      !Boolean(currentSticker.is_video || (currentSticker as any).isVideo) &&
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
      <div style={{ 
        height: isModal ? 'auto' : '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 'var(--tg-spacing-4)'
      }}>
        <Text 
          variant="h3"
          color="secondary"
          align="center"
        >
          Загрузка стикерсета...
        </Text>
      </div>
    );
  }

  // Показываем ошибку если не удалось загрузить
  if (error && !fullStickerSet) {
    return (
      <div style={{ 
        height: isModal ? 'auto' : '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 'var(--tg-spacing-4)',
        padding: 'var(--tg-spacing-4)'
      }}>
        <Text 
          variant="h3"
          style={{ color: 'var(--color-error)' }}
          align="center"
        >
          {error}
        </Text>
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--tg-radius-m)',
            backgroundColor: 'var(--tg-theme-button-color)',
            color: 'var(--tg-theme-button-text-color)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloseIcon size={24} />
        </button>
      </div>
    );
  }

  const handleOutsidePreviewClick = useCallback((event: MouseEvent) => {
    if (!isModal) return;
    
    // Останавливаем всплытие события, чтобы оно не доходило до ModalBackdrop
    event.stopPropagation();
    
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

    document.addEventListener('mousedown', handleBackdropClick as unknown as EventListener);
    
    return () => {
      document.removeEventListener('mousedown', handleBackdropClick as unknown as EventListener);
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
      <div 
        ref={modalContentRef}
        data-modal-content
        style={{
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
          // '@keyframes modalSlideUpFromBottom': {
          //   '0%': {
          //     opacity: 0,
          //     transform: 'translateY(100%)',
          //   },
          //   '100%': {
          //               //     opacity: 1,
          //     transform: 'translateY(0)',
          //   },
          // },
          // '@keyframes modalContentSlideIn': { ... },
        }}
      >
        <StickerSetDetailEdit
          stickerSet={fullStickerSet ?? stickerSet}
          onCancel={handleEditCancel}
          onDone={handleEditDone}
        />
      </div>
    );
  }

  // View-режим (обычный режим просмотра) — стили по Figma #Card
  return (
    <div
      ref={modalContentRef}
      data-modal-content
      onClick={handleOutsidePreviewClick}
      className={`sticker-set-detail-card ${isModal ? 'sticker-set-detail-card--modal' : ''}`}
      style={!isModal ? { height: '100vh', minHeight: '100vh' } : undefined}
    >
      {isModal && <div className="sticker-set-detail-card__handle" />}

      <div className="sticker-set-detail-card__header">
        <Text
          variant="h2"
          weight="bold"
          align="center"
          style={{
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
        </Text>
        {infoVariant === 'default' && authorUsername && stickerSet.authorId && (
          <Link
            to={`/author/${stickerSet.authorId}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Text
              variant="bodySmall"
              weight="semibold"
              align="center"
              style={{
                color: 'var(--tg-theme-link-color)',
                fontSize: '13px',
              }}
            >
              {authorUsername}
            </Text>
          </Link>
        )}
      </div>
      {stickerCount > 0 && (
        <div className="sticker-set-detail-card__main">
          <div className="sticker-set-detail-card__preview-wrap">
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
            <div className="sticker-set-detail-card__actions-overlay" onClick={(e) => e.stopPropagation()}>
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
            </div>
          </div>
        </div>
      )}

      <div className="sticker-set-detail-card__strip">
        <div
          ref={scrollerRef}
          className="sticker-set-detail-card__strip-inner"
          onClick={(e) => e.stopPropagation()}
        >
          {stickers.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 72, padding: 5 }}>
              <Text 
                variant="bodySmall"
                align="center"
                color="secondary"
              >
                Нет стикеров для отображения
              </Text>
            </div>
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
        </div>
      </div>

      <div className="sticker-set-detail-card__footer sticker-detail-info-card" onClick={(e) => e.stopPropagation()}>
        <div className="sticker-set-detail-card__footer-inner">
          <div className="sticker-set-detail-card__categories">
            {displayedCategories.length > 0 ? (
              displayedCategories.map((category) => (
                <div key={category.id} className="sticker-set-detail-card__category-chip">
                  {category.name}
                </div>
              ))
            ) : (
              <Text
                variant="bodySmall"
                color="secondary"
                weight="semibold"
                style={{ fontSize: window.innerWidth <= 400 ? '12px' : undefined }}
              >
                Категории не назначены
              </Text>
            )}
          </div>
          <div className="sticker-set-detail-card__footer-actions">
              {/* Кнопка "Изменить" (только для автора, только в режиме view) */}
              {isAuthor && mode === 'view' && (
                <button
                  type="button"
                  onClick={() => isAuthor && setMode('edit')}
                  title="Изменить стикерсет"
                  className="sticker-set-detail-card__icon-btn sticker-set-detail-card__icon-btn--edit"
                >
                  <EditIcon size={18} />
                </button>
              )}
              {canEditCategories && (
                <button
                  type="button"
                  onClick={handleOpenCategoriesDialog}
                  title="Изменить категории"
                  className="sticker-set-detail-card__icon-btn sticker-set-detail-card__icon-btn--categories"
                >
                  <EditIcon size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="sticker-set-detail-card__divider" />
          {isStickerSetBlocked && (
            <div className="sticker-set-detail-card__alert">
              Набор заблокирован {currentBlockReason ? `— ${currentBlockReason}` : 'без указания причины'}.
            </div>
          )}

          {effectiveStickerSet.availableActions?.includes('DONATE') && (
            <div className="sticker-set-detail-card__donate-wrap">
              <button
                type="button"
                className="sticker-set-detail-card__donate-btn"
                onClick={() => setIsDonateModalOpen(true)}
              >
                Поддержать автора
              </button>
            </div>
          )}

          {effectiveStickerSet.availableActions && effectiveStickerSet.availableActions.length > 0 && (
            <div className="sticker-set-detail-card__actions-wrap">
              <StickerSetActions
                stickerSet={effectiveStickerSet}
                availableActions={effectiveStickerSet.availableActions}
                onActionComplete={handleActionComplete}
              />
            </div>
          )}
      </div>

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

      <DonateModal
        open={isDonateModalOpen}
        onClose={() => setIsDonateModalOpen(false)}
        stickerSetId={effectiveStickerSet?.id || stickerSet.id}
        authorName={authorUsername || undefined}
      />
    </div>
  );
};

