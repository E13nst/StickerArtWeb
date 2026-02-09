import { useState, useEffect, useMemo, FC } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { getAvatarUrl, getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { UserInfo } from '@/store/useProfileStore';
import { getUserFirstName, getUserLastName } from '@/utils/userUtils';

interface FloatingAvatarProps {
  userInfo: UserInfo;
  size?: 'small' | 'medium' | 'large';
  overlap?: number;
}

const sizeMap = {
  small: 0.382,
  medium: 0.5,
  large: 0.618
};

export const FloatingAvatar: FC<FloatingAvatarProps> = ({
  userInfo,
  size = 'large',
  overlap = 35
}) => {
  const [avatarError, setAvatarError] = useState(false);

  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  
  const targetSize = size === 'large' ? 160 : size === 'medium' ? 130 : 100;
  
  const avatarSrc = useMemo(() => {
    if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('blob:')) {
      return userInfo.avatarUrl;
    }
    const userId = userInfo.id || userInfo.telegramId;
    return userInfo.avatarUrl || getAvatarUrl(userId, userInfo.profilePhotoFileId, userInfo.profilePhotos, targetSize);
  }, [userInfo.avatarUrl, userInfo.id, userInfo.telegramId, userInfo.profilePhotoFileId, userInfo.profilePhotos, targetSize]);

  useEffect(() => {
    setAvatarError(false);
  }, [avatarSrc]);

  const initials = getInitials(firstName, lastName);
  const avatarBgColor = getAvatarColor(firstName);

  const avatarSizeRatio = sizeMap[size];
  const avatarWidth = `calc(${avatarSizeRatio * 100}vw)`;
  const maxAvatarSize = size === 'large' ? '160px' : size === 'medium' ? '130px' : '100px';
  const fontSize = size === 'large' ? '2.2rem' : size === 'medium' ? '1.8rem' : '1.4rem';

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10, marginTop: `-${overlap}%`, marginBottom: 16 }}>
      <Avatar
        src={!avatarError ? avatarSrc : undefined}
        size={targetSize}
        style={{
          border: '4px solid var(--tg-theme-bg-color, #ffffff)',
          backgroundColor: avatarBgColor,
          fontSize,
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          aspectRatio: '1 / 1',
          maxWidth: maxAvatarSize,
          maxHeight: maxAvatarSize,
          width: avatarWidth,
          height: avatarWidth
        }}
      >
        {initials}
      </Avatar>
    </div>
  );
};
