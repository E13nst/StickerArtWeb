import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { 
  Box, 
  Typography, 
  IconButton,
  Card,
  CardContent
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import { StickerSetResponse, StickerSetMeta } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { getStickerThumbnailUrl, getStickerImageUrl } from '@/utils/stickerUtils';
import { AnimatedSticker } from './AnimatedSticker';
import { StickerThumbnail } from './StickerThumbnail';
import { useLikesStore } from '@/store/useLikesStore';
import { imageLoader } from '@/utils/imageLoader';
import { LoadPriority } from '@/utils/imageLoader';
import { prefetchSticker } from '@/utils/animationLoader';

// Простое кеширование метаданных для мгновенного отображения при повторном открытии
const metaCache = new Map<number, StickerSetMeta>();

// Кеш полных данных стикерсетов для оптимистичного UI
interface CachedStickerSet {
  data: StickerSetResponse;
  timestamp: number;
  ttl: number; // Время жизни кеша в миллисекундах
}

const stickerSetCache = new Map<number, CachedStickerSet>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Компонент для ленивой загрузки миниатюр
interface LazyThumbnailProps {
  sticker: any;
  index: number;
  activeIndex: number;
  onClick: (idx: number) => void;
  shouldLoadImmediately: boolean;
}

const LazyThumbnail: React.FC<LazyThumbnailProps> = memo(({
  sticker,
  index,
  activeIndex,
  onClick,
  shouldLoadImmediately
}) => {
  const [isInView, setIsInView] = useState(shouldLoadImmediately);
  const [shouldRender, setShouldRender] = useState(shouldLoadImmediately);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Если уже загружаем сразу или это активный стикер - рендерим
    if (shouldLoadImmediately || index === activeIndex) {
      setShouldRender(true);
      setIsInView(true);
      return;
    }

    // Используем IntersectionObserver для lazy loading
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          setShouldRender(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px', // Предзагружаем за 200px до появления
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [shouldLoadImmediately, index, activeIndex]);

  // Всегда рендерим активный стикер
  useEffect(() => {
    if (index === activeIndex) {
      setShouldRender(true);
      setIsInView(true);
    }
  }, [index, activeIndex]);

  return (
    <Box
      ref={containerRef}
      onClick={() => onClick(index)}
      sx={{
        flex: '0 0 auto',
        width: 128,
        height: 128,
        minWidth: 128,
        minHeight: 128,
        borderRadius: 'var(--tg-radius-m)',
        border: '1px solid',
        borderColor: index === activeIndex ? 'primary.main' : 'rgba(255,255,255,0.2)',
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
      {shouldRender ? (
        <>
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
        </>
      ) : (
        // Skeleton placeholder пока не загрузили
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          fontSize: '24px',
          backgroundColor: 'rgba(0,0,0,0.3)'
        }}>
          {sticker.emoji || '🎨'}
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
}

export const StickerSetDetail: React.FC<StickerSetDetailProps> = ({
  stickerSet,
  onBack,
  onShare,
  onLike,
  isInTelegramApp: _isInTelegramApp = false,
  isModal = false
}) => {
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

  const stickerCount = fullStickerSet?.telegramStickerSetInfo?.stickers?.length || stickerSet.telegramStickerSetInfo?.stickers?.length || 0;

  const [meta, setMeta] = useState<StickerSetMeta | null>(() => {
    const cached = metaCache.get(stickerSet.id);
    // Если есть кэш, убираем из него поле likes
    if (cached) {
      return { ...cached, likes: 0 };
    }
    return {
      stickerSetId: stickerSet.id,
      author: { id: 0, firstName: 'Автор', lastName: '', username: undefined, avatarUrl: undefined },
      likes: 0
    };
  });
  const [likeAnim, setLikeAnim] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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

  // Функция предзагрузки миниатюр
  const preloadThumbnails = useCallback(async (stickers: any[]) => {
    if (!isModal) return; // Предзагружаем только в модальном окне
    console.log('🔄 Preloading thumbnails with MODAL priority...');
    
    const promises = stickers.map((sticker, index) => {
      const actualFileId = sticker.thumb?.file_id || sticker.file_id;
      const imageUrl = getStickerThumbnailUrl(actualFileId, 128);
      return imageLoader.loadImage(actualFileId, imageUrl, LoadPriority.TIER_0_MODAL, stickerSet.id.toString(), index);
    });
    
    await Promise.allSettled(promises);
    console.log('✅ All thumbnails preloaded');
  }, [isModal, stickerSet.id]);

  // Функция предзагрузки больших стикеров
  const preloadLargeStickers = useCallback(async (stickers: any[]) => {
    if (!isModal) return; // Предзагружаем только в модальном окне
    console.log('🔄 Preloading large stickers with MODAL priority...');
    
    const promises = stickers.map((sticker, index) => {
      const imageUrl = getStickerImageUrl(sticker.file_id);
      return prefetchSticker(sticker.file_id, imageUrl);
    });
    
    await Promise.allSettled(promises);
    console.log('✅ All large stickers preloaded');
  }, [isModal]);

  // Не инициализируем лайки из пропсов - только из API данных

  // Загружаем полную информацию о стикерсете с сервера (оптимистично - в фоне)
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
        
        // Загружаем полную информацию о стикерсете (параллельно с метаданными)
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
          const thumbnailsToPreload = stickers.slice(0, 15);
          await preloadThumbnails(thumbnailsToPreload);
          
          if (!mounted || abortController.signal.aborted) return;
          
          // Предзагружаем только первые 3 больших стикера (для плавного UX)
          const largeStickersToPreload = stickers.slice(0, 3);
          preloadLargeStickers(largeStickersToPreload);
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
  }, [stickerSet.id, getLikeState, setLike, preloadThumbnails, preloadLargeStickers]);

  // Загружаем метаданные БЕЗ синхронизации лайков
  useEffect(() => {
    let mounted = true;
    apiClient.getStickerSetMeta(stickerSet.id).then((m) => {
      if (!mounted) return;
      // Кэшируем метаданные, но БЕЗ поля likes
      const metaWithoutLikes = { ...m, likes: 0 };
      metaCache.set(stickerSet.id, metaWithoutLikes);
      setMeta(metaWithoutLikes);
      
      // НЕ синхронизируем лайки из метаданных
      // Лайки берутся только из API запроса getStickerSet
    }).catch(() => {});
    return () => { mounted = false; };
  }, [stickerSet.id]);

  // Используем полные данные или fallback к данным из пропсов
  const stickers = fullStickerSet?.telegramStickerSetInfo?.stickers || stickerSet.telegramStickerSetInfo?.stickers || [];
  
  // Отладочная информация
  console.log('🎯 StickerSetDetail:', {
    stickerSetId: stickerSet.id,
    loading,
    error,
    fullStickerSet: !!fullStickerSet,
    stickersCount: stickers.length,
    stickers: stickers.map(s => ({ file_id: s.file_id, emoji: s.emoji }))
  });

  const handleStickerClick = useCallback((idx: number) => {
    setActiveIndex(idx);
  }, []);

  const handleLikeClick = async () => {
    const willLike = !liked;
    setLikeAnim(true);
    window.setTimeout(() => setLikeAnim(false), 220);
    
    try {
      await toggleLike(stickerSet.id.toString());
      if (onLike && willLike) onLike(stickerSet.id, stickerSet.title);
    } catch (error) {
      console.error('Ошибка при лайке:', error);
      // UI уже откатится автоматически в store при ошибке
    }
  };

  const handleShareClick = async () => {
    const url = getStickerThumbnailUrl(stickers[activeIndex]?.file_id);
    try {
      await navigator.clipboard.writeText(url);
      window.alert(url);
    } catch {
      window.alert(url);
    }
  };

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

  return (
    <Box sx={{ 
      height: isModal ? 'auto' : '100vh', 
      overflow: 'hidden', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: 'var(--tg-spacing-3)',
      padding: 'var(--tg-spacing-4)',
      backgroundColor: 'transparent', // Делаем фон полностью прозрачным
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
            key="sticker-container"
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
            <AnimatedSticker
              key={`sticker-${activeIndex}`}
              fileId={stickers[activeIndex]?.file_id}
              imageUrl={getStickerImageUrl(stickers[activeIndex]?.file_id)}
              hidePlaceholder
              className={''}
            />
            <IconButton
              aria-label="close"
              onClick={onBack}
              sx={{
                position: 'absolute',
                top: 'var(--tg-spacing-3)',
                right: 'var(--tg-spacing-3)',
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
                borderRadius: 'var(--tg-radius-s)',
                width: 40,
                height: 40,
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Нижняя горизонтальная лента */}
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <Box
          ref={scrollerRef}
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
              // Оптимизация: загружаем только первые 20 миниатюр сразу, остальные lazy
              const shouldLoadImmediately = idx < 20 || idx === activeIndex;
              
              return (
                <LazyThumbnail
                  key={s.file_id}
                  sticker={s}
                  index={idx}
                  activeIndex={activeIndex}
                  onClick={handleStickerClick}
                  shouldLoadImmediately={shouldLoadImmediately}
                />
              );
            })
          )}
        </Box>
      </Box>

      {/* Информация о наборе: внизу, без аватара, крупное имя набора и кликабельный автор */}
      <Card sx={{ 
        width: 'min(92vw, 720px)', 
        marginTop: 'var(--tg-spacing-3)', 
        zIndex: 9999, // Очень высокий z-index
        position: 'relative',
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Более прозрачный фон
        border: '2px solid rgba(255, 255, 255, 0.3)', // Белая рамка
        borderRadius: 'var(--tg-radius-l)',
        backdropFilter: 'blur(8px)', // Добавляем blur для лучшей читаемости
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)' // Сильная тень
      }}>
        <CardContent sx={{ padding: 'var(--tg-spacing-4)' }}>
          <Typography variant="h5" sx={{ 
            textAlign: 'center', 
            fontWeight: 700,
            color: 'white',
            fontSize: 'var(--tg-font-size-xxl)',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            marginBottom: 'var(--tg-spacing-2)'
          }}>
            {stickerSet.title}
          </Typography>
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--tg-spacing-3)' }}>
              <a 
                href={`/miniapp/profile/${meta.author.id}`} 
                style={{ 
                  textDecoration: 'none', 
                  fontWeight: 600,
                  fontSize: 'var(--tg-font-size-s)',
                  color: '#4fc3f7',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                }}
                onMouseEnter={(e) => e.target.style.color = '#81d4fa'}
                onMouseLeave={(e) => e.target.style.color = '#4fc3f7'}
              >
                {meta.author.firstName} {meta.author.lastName || ''}
              </a>
            </Box>
          )}
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
              color: 'white',
              fontWeight: 600,
              fontSize: 'var(--tg-font-size-m)',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
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
              <ShareIcon />
            </IconButton>
          </Box>
          {/* Категории горизонтальная скролл лента */}
          {(fullStickerSet?.categories && fullStickerSet.categories.length > 0) && (
            <Box sx={{ 
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: 'var(--tg-spacing-3)',
              marginTop: 'var(--tg-spacing-3)',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
            }}>
              {fullStickerSet.categories.map((category) => (
                <Box
                  key={category.id}
                  sx={{
                    flexShrink: 0,
                    padding: '4px 12px',
                    borderRadius: '13px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {category.name}
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
