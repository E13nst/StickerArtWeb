import { useMemo, useEffect, useRef, FC } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getAvatarUrl, getInitials, getAvatarColor } from '@/utils/avatarUtils';
import './HeaderPanel.css';

/**
 * HeaderPanel — шапка с аватаром текущего пользователя, балансом ART и кнопками.
 * Аватар: photo_url из Telegram → blob из API (useUserAvatar) → userInfo → инициалы.
 */
export const HeaderPanel: FC = () => {
  const { user } = useTelegram();
  const { userInfo, currentUserId } = useProfileStore();
  const { avatarBlobUrl } = useUserAvatar(currentUserId ?? undefined);
  const headerRef = useRef<HTMLElement>(null);

  const avatarUrl = useMemo(() => {
    if (!user) return undefined;
    if (user.photo_url) return user.photo_url;
    if (avatarBlobUrl) return avatarBlobUrl;
    if (!userInfo) return undefined;
    return userInfo.avatarUrl ?? getAvatarUrl(userInfo.id, userInfo.profilePhotoFileId, userInfo.profilePhotos, 96);
  }, [user, user?.photo_url, avatarBlobUrl, userInfo]);

  useEffect(() => {
    if (!user) return;
    const updateHeaderHeight = () => {
      if (!headerRef.current) return;
      const height = headerRef.current.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--stixly-header-height', `${height}px`);
    };

    const rafId = requestAnimationFrame(updateHeaderHeight);
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [user]);

  if (!user) return null;

  // Получаем баланс из store или показываем 0
  const balance = userInfo?.artBalance ?? 0;

  // Форматируем баланс с разделителями тысяч
  const formattedBalance = balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const initials = getInitials(user.first_name, user.last_name);
  const placeholderColor = getAvatarColor(user.first_name || user.username || 'U');

  // Обработчики событий
  const handlePlusClick = () => {
    // TODO: Открыть модальное окно пополнения баланса
    console.log('Plus button clicked - пополнение баланса');
  };

  const handleWalletClick = () => {
    // TODO: Подключить TON Connect
    console.log('Wallet button clicked - TON Connect');
  };

  return (
    <header ref={headerRef} className="header-panel" role="banner">
      <div className="header-panel__inner">
        <div className="header-panel__content">
          {/* Аватар: фото или плейсхолдер с инициалами */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user.first_name}
              className="header-panel__avatar"
            />
          ) : (
            <div
              className="header-panel__avatar header-panel__avatar--placeholder"
              style={{ backgroundColor: placeholderColor }}
            >
              {initials || user.first_name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="header-panel__balance">
            <span className="header-panel__balance-text">
              {formattedBalance} ART
            </span>
            <button
              className="header-panel__plus-button"
              aria-label="Пополнить баланс"
              onClick={handlePlusClick}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 3V13M3 8H13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Wallet button */}
          <button
            className="header-panel__wallet"
            aria-label="TON Connect"
            onClick={handleWalletClick}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                fill="currentColor"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
