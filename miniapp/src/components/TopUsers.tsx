import { useState, FC } from 'react';
import { LeaderboardUser } from '@/types/sticker';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { LeaderboardModal } from './LeaderboardModal';
import './TopUsers.css';

interface TopUsersProps {
  authors: LeaderboardUser[];
}

interface UserItemProps {
  author: LeaderboardUser;
  place: 1 | 2 | 3;
}

const BADGE_COLORS: Record<number, string> = {
  1: '#FFC424',
  2: '#919191',
  3: '#DB7F13',
};

const UserItem: FC<UserItemProps> = ({ author, place }) => {
  const { avatarBlobUrl } = useUserAvatar(author.userId);
  const firstName = author.firstName || '';
  const lastName = author.lastName || '';
  const displayName = firstName || author.username || `Пользователь #${author.userId}`;
  const initials = getInitials(firstName, lastName || undefined);
  const avatarBgColor = getAvatarColor(firstName || author.username || 'User');

  return (
    <div className={`top-user-item top-user-item--place-${place}`}>
      <div className="top-user-avatar-container">
        <div className="top-user-avatar" style={{ backgroundColor: avatarBgColor }}>
          {avatarBlobUrl ? (
            <img src={avatarBlobUrl} alt={displayName} className="top-user-avatar-img" />
          ) : (
            <span className="top-user-avatar-initials">{initials}</span>
          )}
        </div>
        <div className="top-user-badge" style={{ backgroundColor: BADGE_COLORS[place] }}>
          {place}
        </div>
      </div>
      <span className="top-user-name">{displayName}</span>
      <span className="top-user-count">{author.publicCount} Added</span>
    </div>
  );
};

export const TopUsers: FC<TopUsersProps> = ({ authors }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  /* Порядок по Figma: слева 2-е, по центру 1-е, справа 3-е */
  const topThree: Array<{ author: LeaderboardUser; place: 1 | 2 | 3 }> = [
    ...(authors[1] ? [{ author: authors[1], place: 2 as const }] : []),
    ...(authors[0] ? [{ author: authors[0], place: 1 as const }] : []),
    ...(authors[2] ? [{ author: authors[2], place: 3 as const }] : []),
  ];

  return (
    <>
      <div className="top-users-card card-base">
        <h2 className="top-users-title">Топ пользователей</h2>
        <div className="top-users-list">
          {topThree.map(({ author, place }) => (
            <UserItem key={author.userId} author={author} place={place} />
          ))}
        </div>
        <div className="top-users-footer">
          <button type="button" onClick={handleOpenModal} className="top-users-link">
            Полный список
          </button>
        </div>
      </div>

      <LeaderboardModal open={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};
