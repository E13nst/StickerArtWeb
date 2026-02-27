import { useEffect, useState, useRef, FC } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { Spinner } from '@/components/ui/Spinner';
import { useNavigate } from 'react-router-dom';
import { ModalBackdrop } from './ModalBackdrop';
import { LeaderboardAuthor } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import './AuthorsLeaderboardModal.css';

const DISMISS_THRESHOLD = 100;
const DRAG_ANIMATION_MS = 200;

interface AuthorsLeaderboardModalProps {
  open: boolean;
  onClose: () => void;
}

interface LeaderboardAuthorItemProps {
  author: LeaderboardAuthor;
  index: number;
}

const LeaderboardAuthorItem: FC<LeaderboardAuthorItemProps> = ({ author, index }) => {
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

  const itemBg = index === 0 ? 'var(--color-primary)' : 'transparent';

  return (
    <div
      onClick={handleClick}
      className="authors-leaderboard-modal__item"
      style={{ backgroundColor: itemBg }}
    >
      <div className="authors-leaderboard-modal__item-place">{index + 1}</div>
      <div className="authors-leaderboard-modal__item-avatar">
        <Avatar
          src={avatarBlobUrl || undefined}
          size={36}
          style={{ backgroundColor: avatarBgColor, fontSize: '0.75rem', fontWeight: 'bold' }}
        >
          {initials}
        </Avatar>
        {index < 3 && (
          <div
            className="authors-leaderboard-modal__item-badge"
            style={{
              backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
            }}
          >
            {index + 1}
          </div>
        )}
      </div>
      <div className="authors-leaderboard-modal__item-info">
        <Text
          variant="bodySmall"
          style={{
            color: 'var(--color-text)',
            fontSize: '0.8125rem',
            fontWeight: index === 0 ? 600 : 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </Text>
      </div>
      <Chip
        label={String(author.publicCount)}
        size="small"
        style={{
          height: '24px',
          fontSize: '0.7rem',
          backgroundColor: index === 0 ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-primary)',
          color: 'var(--color-text)',
          fontWeight: 600,
          minWidth: '40px',
        }}
      />
    </div>
  );
};

export const AuthorsLeaderboardModal: FC<AuthorsLeaderboardModalProps> = ({ open, onClose }) => {
  const [authors, setAuthors] = useState<LeaderboardAuthor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingDownRef = useRef(false);
  const hasLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!open) return;
    if (hasLoadedRef.current) return;

    setLoading(true);
    setError(null);

    apiClient
      .getAuthorsLeaderboard(0, 100)
      .then((response) => {
        setAuthors(response.content);
        setLoading(false);
        hasLoadedRef.current = true;
      })
      .catch((err) => {
        console.error('Ошибка загрузки лидерборда авторов:', err);
        setError('Не удалось загрузить лидерборд');
        setLoading(false);
      });
  }, [open]);

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
        modalElement.classList.add('authors-leaderboard-modal__card--dragging');
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
          modalElement.classList.remove('authors-leaderboard-modal__card--dragging');
          modalElement.classList.add('authors-leaderboard-modal__card--drag-dismissed');
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
          modalElement.classList.remove('authors-leaderboard-modal__card--dragging');
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
      <div ref={contentRef} data-modal-content className="authors-leaderboard-modal__card">
        <div className="authors-leaderboard-modal__handle" aria-hidden="true" />
        <div className="authors-leaderboard-modal__header">
          <h2 className="authors-leaderboard-modal__title">Топ авторов стикерсетов</h2>
          <button
            type="button"
            className="authors-leaderboard-modal__close-btn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div
          ref={scrollContainerRef}
          className="authors-leaderboard-modal__scroll"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="authors-leaderboard-modal__loading">
              <Spinner size={32} />
            </div>
          ) : error ? (
            <div className="authors-leaderboard-modal__error">
              <Text variant="bodySmall" style={{ color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: '0.8125rem' }}>
                {error}
              </Text>
            </div>
          ) : authors.length === 0 ? (
            <div className="authors-leaderboard-modal__empty">
              <Text variant="bodySmall" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                Нет данных
              </Text>
            </div>
          ) : (
            <div className="authors-leaderboard-modal__list">
              {authors.map((author, index) => (
                <LeaderboardAuthorItem key={author.authorId} author={author} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  );

  return createPortal(modal, document.body);
};
