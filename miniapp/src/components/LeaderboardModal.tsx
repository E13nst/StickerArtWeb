import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ModalBackdrop } from './ModalBackdrop';
import { LeaderboardUser } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getInitials, getAvatarColor } from '@/utils/avatarUtils';
import { Avatar, Chip } from '@mui/material';

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

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 1,
        borderRadius: 1.5,
        backgroundColor: index === 0 ? 'var(--tg-theme-button-color)' : 'transparent',
        transition: 'background-color 0.2s ease',
        cursor: 'default'
      }}
    >
      {/* Номер места */}
      <Box
        sx={{
          minWidth: 24,
          textAlign: 'center',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: index < 3 
            ? 'var(--tg-theme-text-color)' 
            : 'var(--tg-theme-hint-color)',
        }}
      >
        {index + 1}
      </Box>

      {/* Аватар */}
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={avatarBlobUrl || undefined}
          sx={{
            width: 36,
            height: 36,
            bgcolor: avatarBgColor,
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}
        >
          {initials}
        </Avatar>
        {/* Бейдж места для топ-3 */}
        {index < 3 && (
          <Box
            sx={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              color: '#000',
              border: '2px solid var(--tg-theme-bg-color)'
            }}
          >
            {index + 1}
          </Box>
        )}
      </Box>

      {/* Информация о пользователе */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            color: index === 0 ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
            fontSize: '0.8125rem',
            fontWeight: index === 0 ? 600 : 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {displayName}
        </Typography>
      </Box>

      {/* Количество публичных стикеров */}
      <Chip
        label={user.publicCount}
        size="small"
        sx={{
          height: '24px',
          fontSize: '0.7rem',
          backgroundColor: index === 0 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'var(--tg-theme-button-color)',
          color: index === 0 
            ? 'var(--tg-theme-button-text-color)' 
            : 'var(--tg-theme-button-text-color)',
          fontWeight: 600,
          minWidth: '40px'
        }}
      />
    </Box>
  );
};

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ open, onClose }) => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  // Загрузка пользователей при открытии модального окна (только один раз)
  useEffect(() => {
    if (!open) return;
    
    // Если данные уже загружены, не загружаем повторно
    if (hasLoadedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    
    apiClient.getUsersLeaderboard(0, 100)
      .then((response) => {
        setUsers(response.content);
        setLoading(false);
        hasLoadedRef.current = true;
      })
      .catch((err) => {
        console.error('Ошибка загрузки лидерборда:', err);
        setError('Не удалось загрузить лидерборд');
        setLoading(false);
      });
  }, [open]); // Загружаем только один раз при первом открытии

  // Свайп вниз для закрытия модального окна
  useEffect(() => {
    if (!open) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;

      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      
      // Если свайп по заголовку или grab handle, всегда разрешаем закрытие
      const target = e.target as HTMLElement;
      const isHeaderArea = target.closest('[data-modal-header]') !== null;
      
      // Если свайп по области списка - проверяем скролл
      if (!isHeaderArea && scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        const isAtTop = scrollContainer.scrollTop === 0;
        // Если не на верху списка - не закрываем
        if (!isAtTop) return;
      }
      
      // Свайп вниз > 80px - закрываем модальное окно
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
      <Box
        ref={modalContentRef}
        data-modal-content
        onClick={handleOutsideClick}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: 'auto',
          maxHeight: { xs: '60vh', sm: '50vh' },
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.75)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          touchAction: 'pan-y',
          zIndex: 'var(--z-modal, 1000)',
          animation: 'modalSlideUpFromBottom 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          '@keyframes modalSlideUpFromBottom': {
            '0%': {
              opacity: 0,
              transform: 'translateY(100%)',
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0)',
            },
          },
        }}
      >
        {/* Grab handle для свайпа */}
        <Box
          data-modal-header
          sx={{
            width: '34px',
            height: '3px',
            backgroundColor: 'var(--tg-theme-hint-color)',
            opacity: 0.4,
            borderRadius: '2px',
            marginTop: '3px',
            marginBottom: '3px',
            alignSelf: 'center',
            flexShrink: 0,
          }}
        />

        {/* Компактный заголовок */}
        <Box
          data-modal-header
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            flexShrink: 0,
          }}
        >
          <Typography
            variant="h6"
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--tg-theme-text-color)',
            }}
          >
            Топ пользователей по добавленным стикерам
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'var(--tg-theme-text-color)',
              width: 32,
              height: 32,
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Скроллируемый список */}
        <Box
          ref={scrollContainerRef}
          onClick={(e) => e.stopPropagation()}
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '8px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 4,
              }}
            >
              <CircularProgress size={32} />
            </Box>
          ) : error ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 4,
                px: 2,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--tg-theme-hint-color)',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                }}
              >
                {error}
              </Typography>
            </Box>
          ) : users.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 4,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--tg-theme-hint-color)',
                  fontSize: '0.8125rem',
                }}
              >
                Нет данных
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {users.map((user, index) => (
                <LeaderboardUserItem key={user.userId} user={user} index={index} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </ModalBackdrop>
  );
};

