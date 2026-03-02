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
