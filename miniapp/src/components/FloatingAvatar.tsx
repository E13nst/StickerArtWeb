import React, { useState } from 'react';
import { Avatar, Box } from '@mui/material';
import { getAvatarUrl, getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { UserInfo } from '@/store/useProfileStore';
import { getUserFirstName, getUserLastName } from '@/utils/userUtils';

interface FloatingAvatarProps {
  userInfo: UserInfo;
  size?: 'small' | 'medium' | 'large';
  overlap?: number; // процент перекрытия (0-50)
}

const sizeMap = {
  small: 0.382, // Золотое сечение (1 - 0.618)
  medium: 0.5, // Половина экрана
  large: 0.618 // Золотое сечение (фибоначчи)
};

export const FloatingAvatar: React.FC<FloatingAvatarProps> = ({
  userInfo,
  size = 'large',
  overlap = 35
}) => {
  const [avatarError, setAvatarError] = useState(false);

  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  const avatarUrl = userInfo.avatarUrl || getAvatarUrl(userInfo.profilePhotoFileId);
  const initials = getInitials(firstName, lastName);
  const avatarBgColor = getAvatarColor(firstName);

  // Вычисляем размер аватара относительно viewport width
  const avatarSizeRatio = sizeMap[size];
  const avatarWidth = `calc(${avatarSizeRatio * 100}vw)`;
  // Гармонические размеры: 160px (large), 130px (medium), 100px (small)
  const maxAvatarSize = size === 'large' ? '160px' : size === 'medium' ? '130px' : '100px';

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        marginTop: `-${overlap}%`,
        marginBottom: 2
      }}
    >
      <Avatar
        src={!avatarError ? avatarUrl : undefined}
        imgProps={{
          onError: () => setAvatarError(true),
          loading: 'lazy'
        }}
        sx={{
          width: { xs: avatarWidth, sm: maxAvatarSize },
          height: { xs: avatarWidth, sm: maxAvatarSize },
          maxWidth: maxAvatarSize,
          maxHeight: maxAvatarSize,
          border: '4px solid',
          borderColor: 'var(--tg-theme-bg-color, #ffffff)',
          backgroundColor: avatarBgColor,
          fontSize: {
            xs: `calc(${avatarSizeRatio} * 2rem)`,
            sm: size === 'large' ? '2.2rem' : size === 'medium' ? '1.8rem' : '1.4rem'
          },
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          aspectRatio: '1 / 1'
        }}
      >
        {initials}
      </Avatar>
    </Box>
  );
};

