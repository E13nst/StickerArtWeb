import { useState, useEffect, FC, ChangeEvent } from 'react';
import { TelegramIcon, DeveloperModeIcon } from '@/components/ui/Icons';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Alert } from '@/components/ui/Alert';
import { Divider } from '@/components/ui/Divider';
import './TelegramAuthModal.css';

interface TelegramAuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthSuccess: (initData: string) => void;
  onAuthError?: (error: string) => void;
  onSkipAuth: () => void;
}

declare global {
  interface Window {
    handleTelegramAuth: (user: unknown) => void;
  }
}

export const TelegramAuthModal: FC<TelegramAuthModalProps> = ({
  open,
  onClose,
  onAuthSuccess,
  onSkipAuth
}) => {
  const [error, setError] = useState<string | null>(null);
  const [initData, setInitData] = useState<string>('');

  useEffect(() => {
    if (open) {
      setError(null);
      const savedInitData = localStorage.getItem('telegram_init_data');
      if (savedInitData) {
        setInitData(savedInitData);
      }
    }
  }, [open]);

  const handleManualAuth = () => {
    if (!initData.trim()) {
      setError('Введите initData');
      return;
    }
    localStorage.setItem('telegram_init_data', initData);
    onAuthSuccess(initData);
    onClose();
  };

  const handleLoadTestData = () => {
    const testInitData = 'query_id=test&user=%7B%22id%22%3A777000%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=' + Math.floor(Date.now() / 1000) + '&hash=test_hash';
    setInitData(testInitData);
  };

  const handleClearData = () => {
    setInitData('');
    localStorage.removeItem('telegram_init_data');
  };

  const renderContent = () => (
    <div className="telegram-auth-modal-content">
      <div style={{ textAlign: 'center', marginBottom: '24px'}}>
        <TelegramIcon size={48} color="var(--tg-theme-button-color)" style={{ marginBottom: '8px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
        <Text variant="h4" style={{ color: 'var(--tg-theme-text-color)', marginBottom: '8px'}}>
          Авторизация через Telegram
        </Text>
        <Text variant="bodySmall" style={{ marginBottom: '16px', color: 'var(--tg-theme-hint-color)' }}>
          Для доступа к полному функционалу откройте приложение через Telegram бота
        </Text>
      </div>

      {error && (
        <Alert severity="error" style={{ marginBottom: '16px'}}>
          {error}
        </Alert>
      )}

      <Divider style={{ margin: '16px 0' }} />
      <Text variant="caption" style={{ color: 'var(--tg-theme-hint-color)', display: 'block', marginBottom: '8px'}}>
        Режим разработки
      </Text>
      <Divider style={{ margin: '8px 0 16px' }} />

      <div style={{ marginBottom: '16px'}}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: 'var(--tg-theme-hint-color)' }}>
          initData для тестирования
        </label>
        <textarea
          className="telegram-auth-textarea"
          rows={4}
          placeholder="Вставьте initData из Telegram Web App..."
          value={initData}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInitData(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Button variant="primary" size="small" icon={<DeveloperModeIcon size={18} />} onClick={handleLoadTestData}>
          Тестовые данные
        </Button>
        <Button variant="outline" size="small" onClick={handleClearData}>
          Очистить
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={handleManualAuth} disabled={!initData.trim()}>
          Войти с initData
        </Button>
        <Button variant="outline" onClick={onSkipAuth}>
          Продолжить без авторизации
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Авторизация</DialogTitle>
      <DialogContent>
        {renderContent()}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
      </DialogActions>
    </Dialog>
  );
};
