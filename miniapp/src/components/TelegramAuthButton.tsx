import { useState, FC } from 'react';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { openTelegramUrl } from '@/utils/openTelegramUrl';
import './TelegramAuthButton.css';

interface TelegramAuthButtonProps {
  onAuthSuccess: (initData: string) => void;
  onAuthError: (error: string) => void;
}

export const TelegramAuthButton: FC<TelegramAuthButtonProps> = ({
  onAuthSuccess,
  onAuthError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTelegramAuth = () => {
    setIsLoading(true);
    setError(null);

    // Создаем URL для авторизации через Telegram
    const botUsername = 'StickerGallery'; // Замените на ваш бот
    const redirectUrl = encodeURIComponent(window.location.origin + window.location.pathname);
    const telegramAuthUrl = `https://t.me/${botUsername}?startapp=${btoa(redirectUrl)}`;

    console.log('🔗 Telegram Auth URL:', telegramAuthUrl);

    // Открываем Telegram для авторизации
    openTelegramUrl(telegramAuthUrl);

    // Слушаем сообщения от Telegram Web App
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://web.telegram.org') {
        return;
      }

      if (event.data.type === 'telegram-auth') {
        const { initData } = event.data;
        if (initData) {
          console.log('✅ Получен initData от Telegram:', initData);
          onAuthSuccess(initData);
          window.removeEventListener('message', handleMessage);
        } else {
          console.error('❌ initData не получен от Telegram');
          onAuthError('Не удалось получить данные авторизации от Telegram');
          window.removeEventListener('message', handleMessage);
        }
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Таймаут для авторизации
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      setIsLoading(false);
      if (!error) {
        setError('Время ожидания авторизации истекло');
      }
    }, 60000); // 60 секунд
  };

  return (
    <div className="telegram-auth-button-container">
      <Text variant="h3" className="telegram-auth-title">
        Авторизация через Telegram
      </Text>
      
      <Text variant="bodySmall" color="hint" className="telegram-auth-description">
        Для доступа к полному функционалу приложения необходимо авторизоваться через Telegram
      </Text>

      {error && (
        <div className="telegram-auth-error">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="large"
        onClick={handleTelegramAuth}
        disabled={isLoading}
        loading={isLoading}
        className="telegram-auth-button"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.717-.962 3.781-1.362 5.02-.168.523-.502.698-.826.715-.7.065-1.232-.463-1.911-.908-1.061-.695-1.662-1.127-2.693-1.805-1.191-.783-.42-1.214.26-1.917.179-.183 3.285-3.015 3.348-3.272.008-.032.014-.15-.056-.213-.07-.063-.174-.042-.248-.024-.106.025-1.793 1.139-5.062 3.345-.48.329-.914.489-1.302.481-.429-.01-1.255-.242-1.868-.442-.752-.245-1.349-.375-1.297-.791.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.477-1.635.099-.001.321.023.465.14.121.099.155.232.171.326.016.094.036.308.02.475z"/>
          </svg>
        }
      >
        {isLoading ? 'Авторизация...' : 'Войти через Telegram'}
      </Button>

      <Text variant="caption" color="secondary" className="telegram-auth-caption">
        Нажмите кнопку, чтобы открыть Telegram и авторизоваться
      </Text>
    </div>
  );
};
