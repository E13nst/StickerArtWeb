import { FC } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { Button } from './ui/Button';

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
}

export const ErrorDisplay: FC<ErrorDisplayProps> = ({ 
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
        <Button
          variant="primary"
          size="medium"
          className="tg-error__button"
          onClick={handleRetry}
        >
          Повторить
        </Button>
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

/* Кнопка «Повторить» — использует компонент Button (стили приложения), только отступ */
.tg-error__button {
  margin-top: var(--spacing-md, 12px);
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
