import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CloseIcon } from '@/components/ui/Icons';
import { ModalBackdrop } from './ModalBackdrop';
import { LeaderboardUser } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { AuthRequiredCTA } from '@/components/AuthRequiredCTA';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import './LeaderboardModal.css';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
}

interface LeaderboardUserItemProps {
  user: LeaderboardUser;
  index: number;
}

const LeaderboardUserItem: React.FC<LeaderboardUserItemProps> = ({ user, index }) => {
  const { avatarBlobUrl } = useUserAvatar(user.userId);
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const displayName = firstName || user.username || `Пользователь #${user.userId}`;
  const initials = getInitials(firstName, lastName || undefined);
  const avatarBgColor = getAvatarColor(firstName || user.username || 'User');
  const isFirst = index === 0;

  return (
    <div
      className={`leaderboard-modal__user-item ${isFirst ? 'leaderboard-modal__user-item--first' : ''}`}
    >
      <div className="leaderboard-modal__user-item__place">
        {index + 1}
      </div>
      <div className="leaderboard-modal__user-item__avatar-wrap">
        <Avatar
          src={avatarBlobUrl || undefined}
          size={40}
          style={{
            backgroundColor: avatarBgColor,
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}
        >
          {initials}
        </Avatar>
      </div>
      <div className="leaderboard-modal__user-item__info">
        {displayName}
      </div>
      <span className="leaderboard-modal__chip">
        {user.publicCount}
      </span>
    </div>
  );
};

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ open, onClose }) => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  const handleRetryAuth = useCallback(() => {
    hasLoadedRef.current = false;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (hasLoadedRef.current) return;

    setLoading(true);
    setError(null);
    setAuthRequired(false);

    apiClient.getUsersLeaderboard(0, 100)
      .then((response) => {
        setUsers(response.content ?? []);
        setAuthRequired(!!response.authRequired);
        setLoading(false);
        hasLoadedRef.current = true;
      })
      .catch((err) => {
        console.error('Ошибка загрузки лидерборда:', err);
        setError('Не удалось загрузить лидерборд');
        setLoading(false);
      });
  }, [open, refreshKey]);

  useEffect(() => {
    if (!open) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      const target = e.target as HTMLElement;
      const isHeaderArea = target.closest('[data-modal-header]') !== null;

      if (!isHeaderArea && scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        const isAtTop = scrollContainer.scrollTop === 0;
        if (!isAtTop) return;
      }

      if (deltaY > 80) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        touchStartYRef.current = null;
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    const modalElement = modalContentRef.current;
    if (modalElement) {
      modalElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      modalElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      modalElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (modalElement) {
        modalElement.removeEventListener('touchstart', handleTouchStart);
        modalElement.removeEventListener('touchmove', handleTouchMove);
        modalElement.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [open, onClose]);

  const handleOutsideClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (modalContentRef.current && !modalContentRef.current.contains(target)) {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  return (
    <ModalBackdrop open={open} onClose={onClose}>
      <div
        ref={modalContentRef}
        data-modal-content
        className="leaderboard-modal__content"
        onClick={handleOutsideClick}
      >
        <div data-modal-header className="leaderboard-modal__grab-handle" />
        <button
          type="button"
          className="leaderboard-modal__close-btn"
          onClick={onClose}
          aria-label="Закрыть"
          data-modal-header
        >
          <CloseIcon />
        </button>
        <div className="leaderboard-modal__inner">
          <div data-modal-header className="leaderboard-modal__header">
            <h2 className="leaderboard-modal__title">
              Топ пользователей по добавлениям
            </h2>
          </div>
          <div
            ref={scrollContainerRef}
            className="leaderboard-modal__scroll"
            onClick={(e) => e.stopPropagation()}
          >
          {loading ? (
            <div style={{ padding: '32px 0' }}>
              <LoadingSpinner message="" />
            </div>
          ) : authRequired ? (
            <div className="leaderboard-modal__empty leaderboard-modal__empty--cta">
              <AuthRequiredCTA
                description="Откройте Stixly в Telegram, чтобы видеть лидерборд"
                buttonText="Открыть @stixlybot"
                icon="🔐"
                onRetry={handleRetryAuth}
              />
            </div>
          ) : error ? (
            <div className="leaderboard-modal__empty">{error}</div>
          ) : users.length === 0 ? (
            <div className="leaderboard-modal__empty">Нет данных</div>
          ) : (
            <div className="leaderboard-modal__list">
              {users.map((user, index) => (
                <LeaderboardUserItem key={user.userId} user={user} index={index} />
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
};
