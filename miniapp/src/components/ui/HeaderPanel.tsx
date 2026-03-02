import { useMemo, useEffect, useRef, useState, FC, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TouchEvent, MouseEvent } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { AccountBalanceWalletIcon } from '@/components/ui/Icons';
import './HeaderPanel.css';

const BASE = (import.meta as any).env?.BASE_URL || '/miniapp/';

/**
 * HeaderPanel — шапка с аватаром текущего пользователя, балансом ART и кнопками.
 * Аватар только из профиля/API (blob, userInfo.avatarUrl). Сторонние URL (user.photo_url) не используются.
 * При отсутствии профиля/аватара или ошибке загрузки — иконка Account.
 */
const DEBUG_PANEL_LONG_PRESS_MS = 3000;

export const HeaderPanel: FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, tg } = useTelegram();
  const { userInfo, currentUserId, isProfileFromAuthenticatedApi } = useProfileStore();
  const { avatarBlobUrl } = useUserAvatar(currentUserId ?? undefined);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // На /author/ и /profile/:id показываем placeholder — аватар автора не в шапке, а на странице
  const isViewingOtherUser = /\/author\/|\/profile\/[^/]+/.test(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const [avatarError, setAvatarError] = useState(false);

  const avatarUrl = useMemo(() => {
    if (!user) return undefined;
    if (!isProfileFromAuthenticatedApi || !userInfo || isViewingOtherUser) return undefined;
    if (avatarBlobUrl) return avatarBlobUrl;
    if (userInfo.avatarUrl) return userInfo.avatarUrl;
    return getAvatarUrl(userInfo.id, userInfo.profilePhotoFileId, userInfo.profilePhotos, 96);
  }, [user, isProfileFromAuthenticatedApi, userInfo, avatarBlobUrl, isViewingOtherUser]);

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

  // Долгое нажатие на аватар (3 сек) — открытие Debug Panel
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTriggeredRef.current = false;
  }, []);

  const handleAvatarTouchStart = useCallback((_e: TouchEvent | MouseEvent) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      window.dispatchEvent(new CustomEvent('stixly-open-debug-panel'));
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }, DEBUG_PANEL_LONG_PRESS_MS);
  }, [tg]);

  const handleAvatarTouchEnd = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  return (
    <header ref={headerRef} className="header-panel" role="banner">
      <div className="header-panel__backdrop" aria-hidden="true" />
      <div className="header-panel__inner">
        <div className="header-panel__content">
          {/* Аватар: фото или иконка Account; долгое нажатие 3 сек — Debug Panel */}
          <div
            className="header-panel__avatar-wrap"
            role="button"
            tabIndex={0}
            aria-label="Аватар; удержание 3 сек — отладка"
            onTouchStart={handleAvatarTouchStart}
            onTouchEnd={handleAvatarTouchEnd}
            onTouchCancel={handleAvatarTouchEnd}
            onMouseDown={handleAvatarTouchStart}
            onMouseUp={handleAvatarTouchEnd}
            onMouseLeave={handleAvatarTouchEnd}
          >
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
          </div>

          <div
            className="header-panel__balance"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/profile?tab=artpoints')}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/profile?tab=artpoints')}
            aria-label="Перейти в ART-points"
          >
            <button
              type="button"
              className="header-panel__plus-button"
              aria-label="Пополнить баланс"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handlePlusClick();
              }}
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
            <span className="header-panel__balance-text">
              {formattedBalance} ART
            </span>
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
