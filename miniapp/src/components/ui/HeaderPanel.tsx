import React from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useProfileStore } from '@/store/useProfileStore';
import './HeaderPanel.css';

/**
 * HeaderPanel - компонент шапки профиля пользователя
 * 
 * Отображает:
 * - Аватар пользователя (из Telegram)
 * - Баланс ART токенов
 * - Кнопка пополнения баланса (+)
 * - Кнопка TON Connect
 * 
 * Данные берутся из:
 * - useTelegram() - информация о пользователе и фото
 * - useProfileStore() - баланс ART
 */
export const HeaderPanel: React.FC = () => {
  const { user } = useTelegram();
  const { userInfo } = useProfileStore();

  // Не показываем компонент, если пользователь не авторизован
  if (!user) {
    return null;
  }

  // Получаем баланс из store или показываем 0
  const balance = userInfo?.artBalance ?? 0;

  // Форматируем баланс с разделителями тысяч
  const formattedBalance = balance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  // URL аватара из Telegram
  const avatarUrl = user.photo_url;

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
    <div className="header-panel">
      <div className="header-panel__content">
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.first_name}
            className="header-panel__avatar"
          />
        ) : (
          <div className="header-panel__avatar header-panel__avatar--placeholder">
            {user.first_name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Balance section */}
        <div className="header-panel__balance">
          <span className="header-panel__balance-text">
            {formattedBalance} ART
          </span>
          <button
            className="header-panel__plus-button"
            onClick={handlePlusClick}
            aria-label="Пополнить баланс"
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
          onClick={handleWalletClick}
          aria-label="TON Connect"
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
  );
};
