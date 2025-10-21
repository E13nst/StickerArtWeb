import React from 'react';
import { useTelegram } from '../hooks/useTelegram';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  onAction
}) => {
  const { tg } = useTelegram();
  
  const handleAction = () => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    onAction?.();
  };

  return (
    <div className="tg-empty" data-testid="empty-state">
      <div className="tg-empty__content">
        <h3 className="tg-empty__title">{title}</h3>
        <p className="tg-empty__message">{message}</p>
        {actionLabel && onAction && (
          <button className="tg-empty__button" onClick={handleAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

// CSS для empty state
const styles = `
.tg-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tg-spacing-6) var(--tg-spacing-4);
  min-height: 300px;
}

.tg-empty__content {
  text-align: center;
  max-width: 400px;
}

.tg-empty__title {
  font-size: var(--tg-font-size-xl);
  font-weight: 600;
  color: var(--tg-theme-text-color);
  margin: 0 0 var(--tg-spacing-3) 0;
  line-height: 1.3;
}

.tg-empty__message {
  font-size: var(--tg-font-size-m);
  color: var(--tg-theme-hint-color);
  margin: 0 0 var(--tg-spacing-5) 0;
  line-height: 1.5;
}

.tg-empty__button {
  background: var(--tg-theme-button-color);
  color: var(--tg-theme-button-text-color);
  border: none;
  border-radius: var(--tg-radius-m);
  padding: var(--tg-spacing-3) var(--tg-spacing-6);
  font-size: var(--tg-font-size-m);
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.1s ease;
  font-family: inherit;
}

.tg-empty__button:active {
  transform: scale(0.96);
}

.tg-empty__button:hover {
  opacity: 0.9;
}
`;

if (typeof document !== 'undefined') {
  const styleId = 'tg-empty-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}
