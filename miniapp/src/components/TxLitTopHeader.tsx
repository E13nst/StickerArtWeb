import { useEffect, useState, useRef, FC, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { UserInfo } from '@/store/useProfileStore';
import { getAvatarUrl, getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { getUserFirstName, getUserLastName } from '@/utils/userUtils';

export interface Banner {
  id: number;
  background: string;
  text?: string;
  imageUrl?: string;
}

interface TxLitTopHeaderProps {
  userInfo?: UserInfo | null;
  banners?: Banner[];
  onBannerClick?: (banner: Banner) => void;
}

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

export const TxLitTopHeader: FC<TxLitTopHeaderProps> = ({
  userInfo,
  banners,
  onBannerClick
}) => {
  const [index, setIndex] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = width * 0.618;
      setDimensions({ width, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const activeBanners = useMemo(() => {
    if (banners && banners.length > 0) return banners;
    return defaultBanners;
  }, [userInfo, banners]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    
    return () => clearInterval(timer);
  }, [activeBanners.length]);

  const current = activeBanners[index];
  const avatarSize = dimensions.width * 0.382;

  return (
    <div
      ref={containerRef}
      onClick={() => onBannerClick?.(current)}
      style={{
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
            padding: '44px 16px 60px',
            textAlign: 'center'
          }}
        >
          {current.imageUrl && (
            <img
              src={current.imageUrl}
              alt="Banner"
              style={{
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

          {current.text && (
            <p
              style={{
                position: 'relative',
                zIndex: 2,
                fontSize: '16px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.95)',
                letterSpacing: '0.3px',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                maxWidth: '90%',
                margin: 0
              }}
            >
              {current.text}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {activeBanners.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            zIndex: 5
          }}
        >
          {activeBanners.map((_, i) => (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: i === index ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>
      )}

      {userInfo && (
        <TxLitAvatarOverlay userInfo={userInfo} avatarSize={avatarSize} />
      )}
    </div>
  );
};

interface TxLitAvatarOverlayProps {
  userInfo: UserInfo;
  avatarSize: number;
}

const TxLitAvatarOverlay: FC<TxLitAvatarOverlayProps> = ({
  userInfo,
  avatarSize
}) => {
  const [avatarError] = useState(false);

  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  const userId = userInfo.id || userInfo.telegramId;
  const avatarUrl = getAvatarUrl(userId, userInfo.profilePhotoFileId, userInfo.profilePhotos) || userInfo.avatarUrl;
  const initials = getInitials(firstName, lastName);
  const avatarBgColor = getAvatarColor(firstName);

  const avatarHeight = avatarSize;

  return (
    <div
      style={{
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
        size={Math.max(120, avatarSize)}
        style={{
          border: '4px solid var(--tg-theme-bg-color, #ffffff)',
          backgroundColor: avatarBgColor,
          fontSize: avatarSize > 0 ? `${avatarSize * 0.15}px` : '2rem',
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          aspectRatio: '1 / 1'
        }}
      >
        {initials}
      </Avatar>
    </div>
  );
};
