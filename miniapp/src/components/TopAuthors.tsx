import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeaderboardAuthor } from '@/types/sticker';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { AuthorsLeaderboardModal } from './AuthorsLeaderboardModal';
import { Text } from '@/components/ui/Text';
import './TopAuthors.css';

interface TopAuthorsProps {
  authors: LeaderboardAuthor[];
}

interface AuthorItemProps {
  author: LeaderboardAuthor;
  index: number;
}

const AuthorItem: React.FC<AuthorItemProps> = ({ author, index }) => {
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
      className={`top-author-item ${index === 0 ? 'top-author-item--first' : ''}`}
      style={{ cursor: 'pointer' }}
    >
      {/* Аватар */}
      <div className="top-author-avatar-container">
        <div className="top-author-avatar" style={{ backgroundColor: avatarBgColor }}>
          {avatarBlobUrl ? (
            <img src={avatarBlobUrl} alt={displayName} className="top-author-avatar-img" />
          ) : (
            <span className="top-author-avatar-initials">{initials}</span>
          )}
        </div>
        {/* Бейдж места */}
        {index < 3 && (
          <div 
            className="top-author-badge"
            style={{
              backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'
            }}
          >
            {index + 1}
          </div>
        )}
      </div>

      {/* Информация об авторе */}
      <div className="top-author-info">
        <Text 
          variant="bodySmall" 
          weight={index === 0 ? 'semibold' : 'regular'}
          className={`top-author-name ${index === 0 ? 'top-author-name--first' : ''}`}
        >
          {displayName}
        </Text>
      </div>

      {/* Количество публичных стикерсетов */}
      <span className={`top-author-count ${index === 0 ? 'top-author-count--first' : ''}`}>
        {author.publicCount}
      </span>
    </div>
  );
};

export const TopAuthors: React.FC<TopAuthorsProps> = ({ authors }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="top-authors-card card-base">
        <Text variant="caption" color="hint" className="top-authors-title">
          Топ авторов стикерсетов
        </Text>
        
        <div className="top-authors-list">
          {authors.map((author, index) => (
            <AuthorItem key={author.authorId} author={author} index={index} />
          ))}
        </div>
        
        {/* Ссылка "Полный список" */}
        <div className="top-authors-footer">
          <button
            onClick={handleOpenModal}
            className="top-authors-link"
          >
            Полный список
          </button>
        </div>
      </div>

      <AuthorsLeaderboardModal open={isModalOpen} onClose={handleCloseModal} />
    </>
  );
};
