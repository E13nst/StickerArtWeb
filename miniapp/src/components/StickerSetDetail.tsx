import React, { useEffect, useRef, useState, useCallback } from 'react';
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

// Простое кеширование метаданных для мгновенного отображения при повторном открытии
const metaCache = new Map<number, StickerSetMeta>();

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
  const [fullStickerSet, setFullStickerSet] = useState<StickerSetResponse | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Не инициализируем лайки из пропсов - только из API данных

  // Загружаем полную информацию о стикерсете с сервера
  useEffect(() => {
    let mounted = true;
    
    const loadFullStickerSet = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Загружаем полную информацию о стикерсете
        const fullData = await apiClient.getStickerSet(stickerSet.id);
        if (mounted) {
          setFullStickerSet(fullData);
          
          // Инициализируем лайки только если API предоставляет данные
          // API может вернуть либо likesCount, либо likes
          const apiLikesCount = fullData.likesCount ?? fullData.likes;
          const apiIsLiked = fullData.isLikedByCurrentUser ?? fullData.isLiked;
          
          if (apiLikesCount !== undefined && apiLikesCount >= 0) {
            const currentState = getLikeState(stickerSet.id.toString());
            
            // Обновляем данные от API (они приоритетнее локального store)
            setLike(
              stickerSet.id.toString(), 
              apiIsLiked ?? currentState.isLiked,  // Если API не вернул - берем из store
              apiLikesCount
            );
            
            console.log(`🔍 DEBUG StickerSetDetail: Инициализация лайков для ${stickerSet.id}:`, {
              apiLikesCount,
              apiIsLiked,
              currentState
            });
          }
          
          // Предзагружаем миниатюры асинхронно
          preloadThumbnails(fullData.telegramStickerSetInfo?.stickers || []);
          
          // Предзагружаем большие стикеры асинхронно
          setTimeout(() => {
            preloadLargeStickers(fullData.telegramStickerSetInfo?.stickers || []);
          }, 1000); // Задержка 1 секунда, чтобы не блокировать UI
        }
      } catch (err) {
        console.warn('Ошибка загрузки полной информации о стикерсете:', err);
        if (mounted) {
          setError('Не удалось загрузить полную информацию о стикерсете');
          // Используем данные из пропсов как fallback
          setFullStickerSet(stickerSet);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadFullStickerSet();
    return () => { mounted = false; };
  }, [stickerSet.id, getLikeState, setLike]);

  // Функция предзагрузки миниатюр
  const preloadThumbnails = (stickers: any[]) => {
    console.log('🔄 Preloading thumbnails...');
    stickers.forEach((sticker, index) => {
      const actualFileId = sticker.thumb?.file_id || sticker.file_id;
      const imageUrl = getStickerThumbnailUrl(actualFileId, 128);
      
      // Создаем Image объект для предзагрузки
      const img = new Image();
      img.onload = () => {
        console.log(`✅ Preloaded thumbnail ${index + 1}/${stickers.length}`);
      };
      img.onerror = () => {
        console.warn(`❌ Failed to preload thumbnail ${index + 1}`);
      };
      img.src = imageUrl;
    });
  };

  // Функция предзагрузки больших стикеров (только первые несколько)
  const preloadLargeStickers = (stickers: any[]) => {
    console.log('🔄 Preloading large stickers...');
    // Предзагружаем только первые 3 стикера для быстрого переключения
    const stickersToPreload = stickers.slice(0, 3);
    
    stickersToPreload.forEach((sticker, index) => {
      const imageUrl = getStickerImageUrl(sticker.file_id);
      
      // Создаем Image объект для предзагрузки
      const img = new Image();
      img.onload = () => {
        console.log(`✅ Preloaded large sticker ${index + 1}/${stickersToPreload.length}`);
      };
      img.onerror = () => {
        console.warn(`❌ Failed to preload large sticker ${index + 1}`);
      };
      img.src = imageUrl;
    });
  };

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

  // Показываем индикатор загрузки если данные еще загружаются
  if (loading) {
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
              console.log('🎯 Rendering thumbnail:', { 
                idx, 
                fileId: s.file_id, 
                thumbFileId: s.thumb?.file_id,
                emoji: s.emoji,
                hasThumb: !!s.thumb
              });
              return (
                <Box
                  key={s.file_id}
                  data-thumb={idx}
                  onClick={() => handleStickerClick(idx)}
                  sx={{
                    flex: '0 0 auto',
                    width: 128,
                    height: 128,
                    minWidth: 128,
                    minHeight: 128,
                    borderRadius: 'var(--tg-radius-m)',
                    border: '1px solid',
                    borderColor: idx === activeIndex ? 'primary.main' : 'rgba(255,255,255,0.2)',
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
                    fileId={s.file_id}
                    thumbFileId={s.thumb?.file_id}
                    emoji={s.emoji}
                    size={128}
                  />
                  {s.emoji && (
                    <Box sx={{
                      position: 'absolute',
                      bottom: 'var(--tg-spacing-2)',
                      left: 'var(--tg-spacing-2)',
                      color: 'white',
                      fontSize: 'var(--tg-font-size-xl)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 3px 6px rgba(0,0,0,0.35)'
                    }}>
                      {s.emoji}
                    </Box>
                  )}
                </Box>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--tg-spacing-2)' }}>
              <Typography variant="body2" sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 'var(--tg-font-size-s)',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)'
              }}>
                Автор: {meta.author.firstName} {meta.author.lastName || ''}
              </Typography>
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
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--tg-spacing-2)' }}>
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
        </CardContent>
      </Card>
    </Box>
  );
};
