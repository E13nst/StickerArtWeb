import { useEffect, useState, FC } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { Text } from '@/components/ui/Text';
import './AuthorDisplay.css';

interface AuthorDisplayProps {
  authorId: number;
  /** Username из API стикерсета (если есть) */
  username?: string | null;
  /** Имя из API стикерсета (если есть) */
  firstName?: string | null;
  /** Фамилия из API стикерсета (если есть) */
  lastName?: string | null;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Отображает имя автора: из props, или загружает из API /users/{id}/profile по authorId.
 */
export const AuthorDisplay: FC<AuthorDisplayProps> = ({
  authorId,
  username,
  firstName,
  lastName,
  className,
  onClick
}) => {
  const [displayName, setDisplayName] = useState<string | null>(() => {
    const full = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (username?.trim()) return `@${username.trim()}`;
    return null;
  });

  useEffect(() => {
    if (displayName) return;
    let cancelled = false;
    apiClient
      .getProfile(authorId)
      .then((userInfo) => {
        if (cancelled) return;
        const fromName = [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ').trim();
        const fromUsername = userInfo.username?.trim();
        setDisplayName(fromName || (fromUsername ? `@${fromUsername}` : null) || 'Автор');
      })
      .catch(() => {
        if (cancelled) return;
        setDisplayName('Автор');
      });
    return () => {
      cancelled = true;
    };
  }, [authorId, displayName]);

  const label = displayName ?? '…';

  return (
    <span className="author-display author-display--inline">
      <span className="author-display__by">by </span>
      <Link
        to={`/author/${authorId}`}
        className={className}
        onClick={(e) => {
          onClick?.(e);
        }}
      >
        <Text variant="body" color="primary" as="span">
          {label}
        </Text>
      </Link>
    </span>
  );
};
