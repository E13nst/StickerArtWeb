import React, { useState } from 'react';
import { LeaderboardUser } from '@/types/sticker';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { LeaderboardModal } from './LeaderboardModal';
import { Text } from '@/components/ui/Text';
import './TopUsers.css';

interface TopUsersProps {
  authors: LeaderboardUser[];
}

interface UserItemProps {
  author: LeaderboardUser;
  index: number;
}

const UserItem: React.FC<UserItemProps> = ({ author, index }) => {
  const { avatarBlobUrl } = useUserAvatar(author.userId);
  const firstName = author.firstName || '';
  const lastName = author.lastName || '';
  const displayName = firstName || author.username || `Пользователь #${author.userId}`;
  const initials = getInitials(firstName, lastName || undefined);
  const avatarBgColor = getAvatarColor(firstName || author.username || 'User');

  return (
    <div className={`top-user-item ${index === 0 ? 'top-user-item--first' : ''}`}>
      {/* Аватар */}
      <div className="top-user-avatar-container">
        <div className="top-user-avatar" style={{ backgroundColor: avatarBgColor }}>
          {avatarBlobUrl ? (
            <img src={avatarBlobUrl} alt={displayName} className="top-user-avatar-img" />
          ) : (
            <span className="top-user-avatar-initials">{initials}</span>
          )}
        </div>
        {/* Бейдж места */}
        {index < 3 && (
          <div 
            className="top-user-badge"
            style={{
              backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'
            }}
          >
            {index + 1}
          </div>
        )}
      </div>

      {/* Информация о пользователе */}
      <div className="top-user-info">
        <Text 
          variant="bodySmall" 
          weight={index === 0 ? 'semibold' : 'regular'}
          className={`top-user-name ${index === 0 ? 'top-user-name--first' : ''}`}
        >
          {displayName}
        </Text>
      </div>

      {/* Количество публичных стикеров */}
      <span className={`top-user-count ${index === 0 ? 'top-user-count--first' : ''}`}>
        {author.publicCount}
      </span>
    </div>
  );
};

export const TopUsers: React.FC<TopUsersProps> = ({ authors }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="top-users-card card-base">
        <Text variant="caption" color="hint" className="top-users-title">
          Топ пользователей по добавленным стикерам
        </Text>
        
        <div className="top-users-list">
          {authors.map((author, index) => (
            <UserItem key={author.userId} author={author} index={index} />
          ))}
        </div>
        
        {/* Ссылка "Полный список" */}
        <div className="top-users-footer">
          <button
            onClick={handleOpenModal}
            className="top-users-link"
          >
            Полный список
          </button>
        </div>
      </div>

      <LeaderboardModal open={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};
