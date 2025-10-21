import React from 'react';
import { useTelegram } from '../hooks/useTelegram';

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onRetry 
}) => {
  const { tg } = useTelegram();
  
  const handleRetry = () => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
    onRetry?.();
  };

  return (
    <div className="tg-error" data-testid="error-display">
      <div className="tg-error__icon">⚠️</div>
      <h3 className="tg-error__title">Ошибка</h3>
      <p className="tg-error__message">{error}</p>
      {onRetry && (
        <button className="tg-error__button" onClick={handleRetry}>
          Повторить
        </button>
      )}
    </div>
  );
};

// CSS для error display
const styles = `
.tg-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--tg-spacing-6) var(--tg-spacing-4);
  text-align: center;
  min-height: 200px;
}

.tg-error__icon {
  font-size: 48px;
  margin-bottom: var(--tg-spacing-3);
}

.tg-error__title {
  font-size: var(--tg-font-size-l);
  font-weight: 600;
  color: var(--tg-theme-text-color);
  margin: 0 0 var(--tg-spacing-2) 0;
}

.tg-error__message {
  font-size: var(--tg-font-size-m);
  color: var(--tg-theme-hint-color);
  margin: 0 0 var(--tg-spacing-4) 0;
  line-height: 1.5;
}

.tg-error__button {
  background: var(--tg-theme-button-color);
  color: var(--tg-theme-button-text-color);
  border: none;
  border-radius: var(--tg-radius-m);
  padding: var(--tg-spacing-3) var(--tg-spacing-5);
  font-size: var(--tg-font-size-m);
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.1s ease;
  font-family: inherit;
}

.tg-error__button:active {
  transform: scale(0.96);
}

.tg-error__button:hover {
  opacity: 0.9;
}
`;

if (typeof document !== 'undefined') {
  const styleId = 'tg-error-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}
