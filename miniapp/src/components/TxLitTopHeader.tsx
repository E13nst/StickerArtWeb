import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Avatar } from '@mui/material';
import { UserInfo } from '@/store/useProfileStore';
import { getAvatarUrl, getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { getUserFirstName, getUserLastName } from '@/utils/userUtils';

export interface Banner {
  id: number;
  background: string; // CSS gradient или image URL
  text?: string;
  imageUrl?: string; // Опциональный URL изображения поверх градиента
}

interface TxLitTopHeaderProps {
  userInfo?: UserInfo | null;
  banners?: Banner[];
  onBannerClick?: (banner: Banner) => void;
}

// Дефолтные баннеры
const defaultBanners: Banner[] = [
  {
    id: 1,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    text: 'Find • Create • Smile with stickers'
  },
  {
    id: 2,
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    text: 'Your universe of Telegram stickers'
  },
  {
    id: 3,
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    text: 'Art. Fun. Community.'
  }
];

export const TxLitTopHeader: React.FC<TxLitTopHeaderProps> = ({
  userInfo,
  banners,
  onBannerClick
}) => {
  const [index, setIndex] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Вычисление размеров по золотому сечению
  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = width * 0.618; // Золотое сечение
      setDimensions({ width, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Определяем баннеры: кастомные из userInfo или переданные, иначе дефолтные
  const activeBanners = React.useMemo(() => {
    // TODO: в будущем можно добавить userInfo.banners или userInfo.customBanners
    // if (userInfo?.customBanners?.length) return userInfo.customBanners;
    if (banners && banners.length > 0) return banners;
    return defaultBanners;
  }, [userInfo, banners]);

  // Автопрокрутка карусели
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [activeBanners.length]);

  const current = activeBanners[index];

  // Вычисляем размер аватара (0.382 от ширины)
  const avatarSize = dimensions.width * 0.382;
  const avatarHeight = avatarSize;

  return (
    <Box
      ref={containerRef}
      onClick={() => onBannerClick?.(current)}
      sx={{
        position: 'relative',
        width: '100vw',
        height: dimensions.height || '0px',
        minHeight: '200px',
        overflow: 'hidden',
        borderRadius: '0 0 24px 24px',
        cursor: onBannerClick ? 'pointer' : 'default',
        transition: 'height 0.3s ease'
      }}
    >
      {/* Карусель баннеров */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            background: current.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '44px 16px 60px', // Отступ снизу для аватара
            textAlign: 'center'
          }}
        >
          {/* Опциональное изображение поверх градиента */}
          {current.imageUrl && (
            <Box
              component="img"
              src={current.imageUrl}
              alt="Banner"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.6,
                zIndex: 1
              }}
            />
          )}

          {/* Текст баннера */}
          {current.text && (
            <Box
              component="p"
              sx={{
                position: 'relative',
                zIndex: 2,
                fontSize: { xs: '14px', sm: '16px' },
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.95)',
                letterSpacing: '0.3px',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                maxWidth: '90%',
                margin: 0
              }}
            >
              {current.text}
            </Box>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Индикаторы слайдов */}
      {activeBanners.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 1,
            zIndex: 5
          }}
        >
          {activeBanners.map((_, i) => (
            <Box
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: i === index ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  transform: 'scale(1.2)'
                }
              }}
            />
          ))}
        </Box>
      )}

      {/* Аватар - абсолютное позиционирование снизу */}
      {userInfo && (
        <TxLitAvatarOverlay userInfo={userInfo} avatarSize={avatarSize} />
      )}
    </Box>
  );
};

// Внутренний компонент аватара для TxLitTopHeader
interface TxLitAvatarOverlayProps {
  userInfo: UserInfo;
  avatarSize: number;
}

const TxLitAvatarOverlay: React.FC<TxLitAvatarOverlayProps> = ({
  userInfo,
  avatarSize
}) => {
  const [avatarError, setAvatarError] = useState(false);

  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  const avatarUrl = getAvatarUrl(userInfo.profilePhotoFileId, userInfo.profilePhotos) || userInfo.avatarUrl;
  const initials = getInitials(firstName, lastName);
  const avatarBgColor = getAvatarColor(firstName);

  const avatarHeight = avatarSize;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: -(avatarHeight * 0.5),
        left: '50%',
        transform: 'translateX(-50%)',
        width: avatarSize,
        height: avatarSize,
        zIndex: 10,
        pointerEvents: 'none'
      }}
    >
      <Avatar
        src={!avatarError ? avatarUrl : undefined}
        imgProps={{
          onError: () => setAvatarError(true),
          loading: 'lazy'
        }}
        sx={{
          width: '100%',
          height: '100%',
          maxWidth: avatarSize,
          maxHeight: avatarSize,
          minWidth: '120px',
          minHeight: '120px',
          border: '4px solid',
          borderColor: 'var(--tg-theme-bg-color, #ffffff)',
          backgroundColor: avatarBgColor,
          fontSize: avatarSize > 0 ? `${avatarSize * 0.15}px` : '2rem',
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          aspectRatio: '1 / 1'
        }}
      >
        {initials}
      </Avatar>
    </Box>
  );
};

