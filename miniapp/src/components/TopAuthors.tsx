import { useState, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaderboardAuthor } from '@/types/sticker';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { AuthorsLeaderboardModal } from './AuthorsLeaderboardModal';
import './TopAuthors.css';

interface TopAuthorsProps {
  authors: LeaderboardAuthor[];
}

interface AuthorItemProps {
  author: LeaderboardAuthor;
  place: 1 | 2 | 3; /* 1 = центр (крупный), 2 = слева, 3 = справа */
}

const BADGE_COLORS: Record<number, string> = {
  1: '#FFC424',
  2: '#919191',
  3: '#DB7F13',
};

const AuthorItem: FC<AuthorItemProps> = ({ author, place }) => {
  const navigate = useNavigate();
  const { avatarBlobUrl } = useUserAvatar(author.authorId);
  const firstName = author.firstName || '';
  const lastName = author.lastName || '';
  const displayName = firstName || author.username || `Автор #${author.authorId}`;
  const initials = getInitials(firstName, lastName || undefined);
  const avatarBgColor = getAvatarColor(firstName || author.username || 'Author');

  const handleClick = () => {
    navigate(`/author/${author.authorId}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`top-author-item top-author-item--place-${place}`}
      style={{ cursor: 'pointer' }}
    >
      <div className="top-author-avatar-container">
        <div className="top-author-avatar" style={{ backgroundColor: avatarBgColor }}>
          {avatarBlobUrl ? (
            <img src={avatarBlobUrl} alt={displayName} className="top-author-avatar-img" />
          ) : (
            <span className="top-author-avatar-initials">{initials}</span>
          )}
        </div>
        <div className="top-author-badge" style={{ backgroundColor: BADGE_COLORS[place] }}>
          {place}
        </div>
      </div>
      <span className="top-author-name">{displayName}</span>
      <span className="top-author-count">{author.publicCount} Created</span>
    </div>
  );
};

export const TopAuthors: FC<TopAuthorsProps> = ({ authors }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  /* Порядок по Figma: слева 2-е место, по центру 1-е, справа 3-е */
  const topThree: Array<{ author: LeaderboardAuthor; place: 1 | 2 | 3 }> = [
    ...(authors[1] ? [{ author: authors[1], place: 2 as const }] : []),
    ...(authors[0] ? [{ author: authors[0], place: 1 as const }] : []),
    ...(authors[2] ? [{ author: authors[2], place: 3 as const }] : []),
  ];

  return (
    <>
      <div className="top-authors-card card-base">
        <h2 className="top-authors-title">Топ авторов</h2>
        <div className="top-authors-list">
          {topThree.map(({ author, place }) => (
            <AuthorItem key={author.authorId} author={author} place={place} />
          ))}
        </div>
        <div className="top-authors-footer">
          <button type="button" onClick={handleOpenModal} className="top-users-link">
            Полный список
          </button>
        </div>
      </div>

      <AuthorsLeaderboardModal open={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};
