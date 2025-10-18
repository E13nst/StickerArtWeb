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
import { getStickerThumbnailUrl } from '@/utils/stickerUtils';
import { AnimatedSticker } from './AnimatedSticker';

// Простое кеширование метаданных для мгновенного отображения при повторном открытии
const metaCache = new Map<number, StickerSetMeta>();

interface StickerSetDetailProps {
  stickerSet: StickerSetResponse;
  onBack: () => void;
  onShare: (name: string, title: string) => void;
  onLike?: (id: number, title: string) => void;
  isInTelegramApp?: boolean;
}

export const StickerSetDetail: React.FC<StickerSetDetailProps> = ({
  stickerSet,
  onBack,
  onShare,
  onLike,
  isInTelegramApp: _isInTelegramApp = false
}) => {
  const stickerCount = stickerSet.telegramStickerSetInfo?.stickers?.length || 0;

  const [meta, setMeta] = useState<StickerSetMeta | null>(() => {
    const cached = metaCache.get(stickerSet.id);
    return cached || {
      stickerSetId: stickerSet.id,
      author: { id: 0, firstName: 'Автор', lastName: '', username: undefined, avatarUrl: undefined },
      likes: 0
    };
  });
  const [likes, setLikes] = useState<number>(meta?.likes || 0);
  const [liked, setLiked] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient.getStickerSetMeta(stickerSet.id).then((m) => {
      if (!mounted) return;
      metaCache.set(stickerSet.id, m);
      setMeta(m);
      setLikes(m.likes || 0);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [stickerSet.id]);

  const stickers = stickerSet.telegramStickerSetInfo?.stickers || [];

  const handleStickerClick = useCallback((idx: number) => {
    setFadeIn(false);
    window.setTimeout(() => {
      setActiveIndex(idx);
      setFadeIn(true);
    }, 100);
  }, []);

  const handleLikeClick = () => {
    const willLike = !liked;
    setLiked(willLike);
    setLikes((v) => v + (willLike ? 1 : -1));
    setLikeAnim(true);
    window.setTimeout(() => setLikeAnim(false), 220);
    if (onLike && willLike) onLike(stickerSet.id, stickerSet.title);
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

  return (
    <Box sx={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
      {/* Основной квадратный превью блок */}
      {stickerCount > 0 && (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Box sx={{
            position: 'relative',
            width: 'min(82vw, 44vh)',
            maxWidth: 480,
            aspectRatio: '1 / 1',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: fadeIn ? 1 : 0,
            transition: 'opacity 180ms ease',
            mt: 1
          }}>
            <AnimatedSticker
              fileId={stickers[activeIndex]?.file_id}
              imageUrl={getStickerThumbnailUrl(stickers[activeIndex]?.file_id)}
              hidePlaceholder
              className={''}
            />
            <IconButton
              aria-label="close"
              onClick={onBack}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
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
            gap: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
            px: 1,
            py: 1,
            maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {stickers.map((s, idx) => (
            <Box
              key={s.file_id}
              data-thumb={idx}
              onClick={() => handleStickerClick(idx)}
              sx={{
                flex: '0 0 auto',
                width: 112,
                height: 112,
                borderRadius: 2,
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
              <AnimatedSticker
                fileId={s.file_id}
                imageUrl={getStickerThumbnailUrl(s.file_id)}
                emoji={undefined}
                hidePlaceholder
                className={''}
              />
              {s.emoji && (
                <Box sx={{
                  position: 'absolute',
                  bottom: 6,
                  left: 6,
                  color: 'white',
                  fontSize: 20,
                  textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 3px 6px rgba(0,0,0,0.35)'
                }}>
                  {s.emoji}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Информация о наборе: внизу, без аватара, крупное имя набора и кликабельный автор */}
      <Card sx={{ width: 'min(92vw, 720px)', mt: 1 }}>
        <CardContent>
          <Typography variant="h5" sx={{ textAlign: 'center', fontWeight: 700 }}>
            {stickerSet.title}
          </Typography>
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Автор: {meta.author.firstName} {meta.author.lastName || ''}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mt: 1 }}>
            <IconButton
              aria-label="like"
              onClick={handleLikeClick}
              sx={{
                width: 48,
                height: 48,
                backgroundColor: liked ? 'error.light' : 'rgba(0,0,0,0.06)',
                color: liked ? 'error.main' : 'text.secondary',
                borderRadius: '50%',
                transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease',
                transform: likeAnim ? 'scale(1.2)' : 'scale(1.0)',
                '&:hover': { backgroundColor: liked ? 'error.light' : 'rgba(0,0,0,0.08)' }
              }}
            >
              <FavoriteIcon />
            </IconButton>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 24, textAlign: 'center' }}>
              {likes}
            </Typography>
            <IconButton
              aria-label="share"
              onClick={handleShareClick}
              sx={{
                width: 44,
                height: 44,
                backgroundColor: 'rgba(0,0,0,0.06)',
                color: 'text.secondary',
                borderRadius: '50%',
                transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.08)', transform: 'scale(1.05)' }
              }}
            >
              <ShareIcon />
            </IconButton>
          </Box>
          {meta && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
              <a href={`/profile/${meta.author.id}`} style={{ textDecoration: 'none', fontWeight: 600 }}>
                {meta.author.firstName} {meta.author.lastName || ''}
              </a>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
