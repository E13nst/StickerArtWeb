import { useMemo, useEffect, useRef, useState, FC, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TouchEvent, MouseEvent } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { AccountBalanceWalletIcon } from '@/components/ui/Icons';
import { useGenerateHistoryHeaderStore } from '@/store/useGenerateHistoryHeaderStore';
import { resolveAvatarContext } from '@/utils/resolvedAvatar';
import './HeaderPanel.css';

const BASE = (import.meta as any).env?.BASE_URL || '/miniapp/';

/**
 * HeaderPanel — шапка с аватаром текущего пользователя, балансом ART и кнопками.
 * Приоритет аватара: blob/API профиль. Если профильный источник ещё не готов,
 * разрешаем безопасный fallback на Telegram photo_url, чтобы UI не расходился с GeneratePage.
 */
const DEBUG_PANEL_LONG_PRESS_MS = 3000;

export const HeaderPanel: FC = () => {
  const { pathname } = useLocation();
  const historySlot = useGenerateHistoryHeaderStore((s) => s.slot);
  const isGenerateRoute = pathname === '/generate';
  const navigate = useNavigate();
  const { user, tg, isInTelegramApp, isMockMode } = useTelegram();
  const { userInfo, currentUserId, isProfileFromAuthenticatedApi } = useProfileStore();
  const { avatarBlobUrl } = useUserAvatar(currentUserId ?? undefined);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const suppressAvatarClickRef = useRef(false);
  /** touch → touchend и синтетический onClick: без этого два `navigate` с разными `?avatar=` и дубли в ленте. */
  const ignoreNextClickAfterTouchRef = useRef(false);

  // На /author/ и /profile/:id показываем placeholder — аватар автора не в шапке, а на странице
  const isViewingOtherUser = /\/author\/|\/profile\/[^/]+/.test(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const [avatarError, setAvatarError] = useState(false);
  const allowHeaderTelegramFallback =
    !isViewingOtherUser &&
    (
      !isInTelegramApp ||
      isMockMode ||
      !isProfileFromAuthenticatedApi ||
      (!avatarBlobUrl && !userInfo?.avatarUrl && !userInfo?.profilePhotoFileId && !userInfo?.profilePhotos)
    );

  const avatarContext = useMemo(() => resolveAvatarContext({
    user,
    userInfo,
    isProfileFromAuthenticatedApi,
    avatarBlobUrl,
    targetSize: 96,
    allowTelegramPhotoFallback: allowHeaderTelegramFallback,
    fallbackUserId: currentUserId,
  }), [allowHeaderTelegramFallback, avatarBlobUrl, currentUserId, isProfileFromAuthenticatedApi, user, userInfo]);

  const avatarUrl = isViewingOtherUser ? undefined : avatarContext.headerAvatarUrl ?? undefined;

  const showAccountIcon = !avatarUrl || avatarError;

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
    const visualViewport = window.visualViewport;
    window.addEventListener('resize', updateHeaderHeight);
    visualViewport?.addEventListener('resize', updateHeaderHeight);
    visualViewport?.addEventListener('scroll', updateHeaderHeight);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateHeaderHeight);
      visualViewport?.removeEventListener('resize', updateHeaderHeight);
      visualViewport?.removeEventListener('scroll', updateHeaderHeight);
    };
  }, []);

  // Получаем баланс из store или показываем 0
  const balance = userInfo?.artBalance ?? 0;

  // Форматируем баланс с разделителями тысяч
  const formattedBalance = balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const handleTopUpNavigate = useCallback(() => {
    navigate('/profile?tab=artpoints');
  }, [navigate]);

  const handleWalletClick = () => {
    // TODO: Подключить TON Connect
    console.log('Wallet button clicked - TON Connect');
  };

  // Долгое нажатие на аватар (3 сек) — нижнее меню + Debug Panel до перезапуска миниаппа
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleAvatarTouchStart = useCallback((_e: TouchEvent | MouseEvent) => {
    longPressTriggeredRef.current = false;
    suppressAvatarClickRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      suppressAvatarClickRef.current = true;
      window.dispatchEvent(new CustomEvent('stixly-open-debug-panel'));
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }, DEBUG_PANEL_LONG_PRESS_MS);
  }, [tg]);

  const navigateToGenerateWithAvatar = useCallback(() => {
    if (suppressAvatarClickRef.current || longPressTriggeredRef.current) {
      suppressAvatarClickRef.current = false;
      longPressTriggeredRef.current = false;
      return;
    }
    navigate(`/generate?avatar=${Date.now()}`);
  }, [navigate]);

  /** onClick: отдельно от touch, иначе touchend + ghost click дадут два navigate. */
  const handleHeaderAvatarClick = useCallback(() => {
    if (ignoreNextClickAfterTouchRef.current) {
      ignoreNextClickAfterTouchRef.current = false;
      return;
    }
    navigateToGenerateWithAvatar();
  }, [navigateToGenerateWithAvatar]);

  const handleAvatarTouchEnd = useCallback((event?: TouchEvent | MouseEvent) => {
    clearLongPress();
    if (event && 'type' in event && event.type === 'touchend') {
      event.preventDefault();
      if (!suppressAvatarClickRef.current && !longPressTriggeredRef.current) {
        ignoreNextClickAfterTouchRef.current = true;
        navigateToGenerateWithAvatar();
      }
    }
  }, [clearLongPress, navigateToGenerateWithAvatar]);

  useEffect(() => () => {
    clearLongPress();
    suppressAvatarClickRef.current = false;
    longPressTriggeredRef.current = false;
  }, [clearLongPress]);

  return (
    <header ref={headerRef} className="header-panel" role="banner">
      <div className="header-panel__backdrop" aria-hidden="true" />
      <div className="header-panel__inner">
        <div className="header-panel__content">
          {/* Аватар: фото или иконка Account; долгое нажатие 3 сек — навбар + Debug Panel */}
          <div
            className="header-panel__avatar-wrap"
            role="button"
            tabIndex={0}
            aria-label="Аватар; удержание 3 сек — меню навигации и отладка (до перезапуска)"
            onTouchStart={handleAvatarTouchStart}
            onTouchEnd={handleAvatarTouchEnd}
            onTouchCancel={handleAvatarTouchEnd}
            onMouseDown={handleAvatarTouchStart}
            onMouseUp={handleAvatarTouchEnd}
            onMouseLeave={handleAvatarTouchEnd}
            onClick={handleHeaderAvatarClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleHeaderAvatarClick();
              }
            }}
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
                alt={user?.first_name ?? userInfo?.firstName ?? 'Avatar'}
                className="header-panel__avatar"
                onError={() => setAvatarError(true)}
              />
            )}
          </div>

          <div
            className="header-panel__balance"
            role="button"
            tabIndex={0}
            onClick={handleTopUpNavigate}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTopUpNavigate();
              }
            }}
            aria-label="Перейти в ART-points"
          >
            <button
              type="button"
              className="header-panel__plus-button"
              aria-label="Пополнить баланс"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleTopUpNavigate();
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

          {isGenerateRoute && historySlot ? (
            <button
              type="button"
              className="header-panel__wallet header-panel__wallet--history"
              aria-label="История генераций"
              aria-expanded={historySlot.open}
              aria-controls="generate-history-modal"
              onClick={historySlot.toggle}
            >
              {historySlot.previewImageUrl ? (
                <img
                  className="header-panel__wallet-preview"
                  src={historySlot.previewImageUrl}
                  alt=""
                />
              ) : (
                <span className="header-panel__wallet-emoji" aria-hidden>
                  {historySlot.fallbackEmoji}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="header-panel__wallet"
              aria-label="TON Connect"
              onClick={handleWalletClick}
            >
              <AccountBalanceWalletIcon size={24} color="currentColor" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
