import { useMemo, useEffect, useRef, useState, FC } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { AccountBalanceWalletIcon } from '@/components/ui/Icons';
import './HeaderPanel.css';

const BASE = (import.meta as any).env?.BASE_URL || '/miniapp/';

/**
 * HeaderPanel — шапка с аватаром текущего пользователя, балансом ART и кнопками.
 * Аватар: photo_url из Telegram → blob из API (useUserAvatar) → userInfo.
 * При отсутствии пользователя/аватара или ошибке загрузки — иконка Account.
 */
export const HeaderPanel: FC = () => {
  const { user } = useTelegram();
  const { userInfo, currentUserId } = useProfileStore();
  const { avatarBlobUrl } = useUserAvatar(currentUserId ?? undefined);
  const headerRef = useRef<HTMLElement>(null);
  const [avatarError, setAvatarError] = useState(false);

  const avatarUrl = useMemo(() => {
    if (!user) return undefined;
    if (user.photo_url) return user.photo_url;
    if (avatarBlobUrl) return avatarBlobUrl;
    if (!userInfo) return undefined;
    return userInfo.avatarUrl ?? getAvatarUrl(userInfo.id, userInfo.profilePhotoFileId, userInfo.profilePhotos, 96);
  }, [user, user?.photo_url, avatarBlobUrl, userInfo]);

  const showAccountIcon = !user || !avatarUrl || avatarError;

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  useEffect(() => {
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
  }, []);

  // Получаем баланс из store или показываем 0
  const balance = userInfo?.artBalance ?? 0;

  // Форматируем баланс с разделителями тысяч
  const formattedBalance = balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

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
          {/* Аватар: фото или иконка Account при отсутствии/ошибке загрузки */}
          {showAccountIcon ? (
            <div className="header-panel__avatar header-panel__avatar--placeholder">
              <span
                style={{
                  width: 28,
                  height: 28,
                  display: 'block',
                  backgroundColor: 'currentColor',
                  WebkitMaskImage: `url(${BASE}assets/account-icon.svg)`,
                  maskImage: `url(${BASE}assets/account-icon.svg)`,
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                }}
                aria-hidden
              />
            </div>
          ) : (
            <img
              src={avatarUrl!}
              alt={user?.first_name ?? 'Avatar'}
              className="header-panel__avatar"
              onError={() => setAvatarError(true)}
            />
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
            <AccountBalanceWalletIcon size={24} color="currentColor" />
          </button>
        </div>
      </div>
    </header>
  );
};
