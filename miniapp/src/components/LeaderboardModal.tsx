import { useEffect, useState, useRef, useCallback, FC } from 'react';
import { createPortal } from 'react-dom';
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

const DISMISS_THRESHOLD = 100;
const DRAG_ANIMATION_MS = 200;

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
}

interface LeaderboardUserItemProps {
  user: LeaderboardUser;
  index: number;
}

const LeaderboardUserItem: FC<LeaderboardUserItemProps> = ({ user, index }) => {
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
      <div className="leaderboard-modal__user-item__place">{index + 1}</div>
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
      <div className="leaderboard-modal__user-item__info">{displayName}</div>
      <span className="leaderboard-modal__chip">{user.publicCount}</span>
    </div>
  );
};

export const LeaderboardModal: FC<LeaderboardModalProps> = ({ open, onClose }) => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingDownRef = useRef(false);
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

    apiClient
      .getUsersLeaderboard(0, 100)
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

    const modalElement = contentRef.current;
    if (!modalElement) return;

    const handleTouchStart = (e: TouchEvent) => {
      const scrollAtTop = scrollContainerRef.current?.scrollTop === 0;
      if (scrollAtTop) {
        touchStartYRef.current = e.touches[0].clientY;
      } else {
        touchStartYRef.current = null;
      }
      isDraggingDownRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;

      const deltaY = e.touches[0].clientY - touchStartYRef.current;

      if (deltaY > 5) {
        isDraggingDownRef.current = true;
        e.preventDefault();
        modalElement.style.transition = 'none';
        modalElement.style.transform = `translateY(${deltaY}px)`;
        modalElement.classList.add('leaderboard-modal__card--dragging');
      } else if (deltaY < -5) {
        touchStartYRef.current = null;
        isDraggingDownRef.current = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartYRef.current === null || !isDraggingDownRef.current) {
        touchStartYRef.current = null;
        isDraggingDownRef.current = false;
        return;
      }

      e.preventDefault();

      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
      touchStartYRef.current = null;
      isDraggingDownRef.current = false;

      const backdrop = modalElement.closest('.modal-backdrop') as HTMLElement | null;

      if (deltaY > DISMISS_THRESHOLD) {
        modalElement.style.transition = `transform ${DRAG_ANIMATION_MS}ms ease-out`;
        modalElement.style.transform = 'translateY(100vh)';

        setTimeout(() => {
          modalElement.classList.remove('leaderboard-modal__card--dragging');
          modalElement.classList.add('leaderboard-modal__card--drag-dismissed');
          if (backdrop && !backdrop.classList.contains('modal-backdrop--keep-navbar')) {
            backdrop.classList.add('modal-backdrop--drag-dismissed');
          }
          onClose();
        }, DRAG_ANIMATION_MS);
      } else {
        modalElement.style.transition = `transform ${DRAG_ANIMATION_MS}ms ease-out`;
        modalElement.style.transform = 'translateY(0)';

        setTimeout(() => {
          modalElement.style.transition = '';
          modalElement.style.transform = '';
          modalElement.classList.remove('leaderboard-modal__card--dragging');
        }, DRAG_ANIMATION_MS);
      }
    };

    modalElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    modalElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    modalElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      modalElement.removeEventListener('touchstart', handleTouchStart);
      modalElement.removeEventListener('touchmove', handleTouchMove);
      modalElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <ModalBackdrop open={open} onClose={onClose} noBlur keepNavbarVisible>
      <div ref={contentRef} data-modal-content className="leaderboard-modal__card">
        <div className="leaderboard-modal__handle" aria-hidden="true" />
        <div className="leaderboard-modal__header-row">
          <h2 className="leaderboard-modal__title">Топ пользователей по добавлениям</h2>
          <button
            type="button"
            className="leaderboard-modal__close-btn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div
          ref={scrollContainerRef}
          className="leaderboard-modal__scroll"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="leaderboard-modal__loading">
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
    </ModalBackdrop>
  );

  return createPortal(modal, document.body);
};
