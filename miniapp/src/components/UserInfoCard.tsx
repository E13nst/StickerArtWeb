import { useState, FC } from 'react';
import { PersonIcon } from '@/components/ui/Icons';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { UserInfo } from '@/store/useProfileStore';
import { getAvatarUrl, getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { getUserFirstName, getUserLastName, getUserFullName, getUserTelegramId } from '@/utils/userUtils';
import './UserInfoCard.css';

interface UserInfoCardProps {
  userInfo: UserInfo;
  isLoading?: boolean;
  onShareProfile?: () => void;
}

export const UserInfoCard: FC<UserInfoCardProps> = ({
  userInfo,
  isLoading = false
}) => {
  const [avatarError, setAvatarError] = useState(false);

  if (isLoading) {
    return (
      <div className="user-info-card user-info-card--loading">
        <div className="user-info-card__content">
          <div className="user-info-card__row">
            <div className="user-info-card__avatar user-info-card__avatar--placeholder">
              <PersonIcon />
            </div>
            <div className="user-info-card__main">
              <Text variant="bodySmall" color="hint">
                Загрузка информации о пользователе...
              </Text>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const firstName = getUserFirstName(userInfo);
  const lastName = getUserLastName(userInfo);
  const displayName = getUserFullName(userInfo);
  const telegramId = getUserTelegramId(userInfo);

    const userId = userInfo.id || userInfo.telegramId;
  const avatarUrl = getAvatarUrl(userId, userInfo.profilePhotoFileId, userInfo.profilePhotos) || userInfo.avatarUrl;
  const initials = getInitials(firstName, lastName);
  const avatarBgColor = getAvatarColor(firstName);

  return (
    <div className="user-info-card">
      <div className="user-info-card__content">
        <div className="user-info-card__row">
          <div
            className="user-info-card__avatar"
            style={{ backgroundColor: avatarBgColor }}
          >
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt={displayName}
                loading="lazy"
                onError={() => setAvatarError(true)}
                className="user-info-card__avatar-img"
              />
            ) : (
              <span className="user-info-card__avatar-initials">{initials}</span>
            )}
          </div>
          <div className="user-info-card__main">
            <Text variant="h3" weight="bold" as="h2" className="user-info-card__name">
              {displayName}
            </Text>
            <Chip
              label={userInfo.role}
              size="small"
              variant="outlined"
              className="user-info-card__role"
            />
          </div>
        </div>
        <div className="user-info-card__footer">
          <Text variant="caption" color="hint" className="user-info-card__telegram-id">
            Telegram ID: {telegramId}
          </Text>
        </div>
      </div>
    </div>
  );
};
