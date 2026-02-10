import { useEffect, useState, useRef, useCallback, FC, MouseEvent } from 'react';
import { CloseIcon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { useNavigate } from 'react-router-dom';
import { ModalBackdrop } from './ModalBackdrop';
import { LeaderboardAuthor } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';

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
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    navigate(`/author/${author.authorId}`);
  };

  const itemBg = index === 0 ? 'var(--color-primary)' : (isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent');

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        borderRadius: '12px',
        backgroundColor: itemBg,
        transition: 'background-color 0.2s ease',
        cursor: 'pointer'
      }}
    >
      {/* Номер места */}
      <div style={{ minWidth: '24px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: index < 3 ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
        {index + 1}
      </div>

      {/* Аватар */}
      <div style={{ position: 'relative' }}>
        <Avatar src={avatarBlobUrl || undefined} size={36} style={{ backgroundColor: avatarBgColor, fontSize: '0.75rem', fontWeight: 'bold' }}>
          {initials}
        </Avatar>
        {/* Бейдж места для топ-3 */}
        {index < 3 && (
          <div style={{ position: 'absolute', top: -3, right: -3, width: '18px', height: '18px', borderRadius: '50%', backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', color: '#000', border: '2px solid var(--color-surface)' }}>
            {index + 1}
          </div>
        )}
      </div>

      {/* Информация об авторе */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySmall" style={{ color: index === 0 ? 'var(--color-text)' : 'var(--color-text)', fontSize: '0.8125rem', fontWeight: index === 0 ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </Text>
      </div>

      {/* Количество публичных стикерсетов */}
      <Chip label={String(author.publicCount)} size="small" style={{ height: '24px', fontSize: '0.7rem', backgroundColor: index === 0 ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-primary)', color: 'var(--color-text)', fontWeight: 600, minWidth: '40px' }} />
    </div>
  );
};

export const AuthorsLeaderboardModal: FC<AuthorsLeaderboardModalProps> = ({ open, onClose }) => {
  const [authors, setAuthors] = useState<LeaderboardAuthor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!open) return;
    
    if (hasLoadedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    
    apiClient.getAuthorsLeaderboard(0, 100)
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

  const handleOutsideClick = useCallback((event: MouseEvent) => {
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
        onClick={handleOutsideClick}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: 'auto',
          maxHeight: '60vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          touchAction: 'pan-y',
          zIndex: 'var(--z-modal, 1000)',
          animation: 'modalSlideUpFromBottom 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Grab handle для свайпа */}
        <div
          data-modal-header
          style={{
            width: '34px',
            height: '3px',
            backgroundColor: 'var(--color-text-secondary)',
            opacity: 0.4,
            borderRadius: '2px',
            marginTop: '3px',
            marginBottom: '3px',
            alignSelf: 'center',
            flexShrink: 0
          }}
        />

        {/* Компактный заголовок */}
        <div
          data-modal-header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            flexShrink: 0
          }}
        >
          <Text variant="h4" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>
            Топ авторов стикерсетов
          </Text>
          <IconButton onClick={onClose} size="small" style={{ color: 'var(--color-text)', width: '32px', height: '32px'}} aria-label="Закрыть">
            <CloseIcon size={18} />
          </IconButton>
        </div>

        {/* Скроллируемый список */}
        <div
          ref={scrollContainerRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '8px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none'
          }}
          className="hide-scrollbar"
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0' }}>
              <Spinner size={32} />
            </div>
          ) : error ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 16px' }}>
              <Text variant="bodySmall" style={{ color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: '0.8125rem' }}>
                {error}
              </Text>
            </div>
          ) : authors.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 0' }}>
              <Text variant="bodySmall" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                Нет данных
              </Text>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {authors.map((author, index) => (
                <LeaderboardAuthorItem key={author.authorId} author={author} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
};
