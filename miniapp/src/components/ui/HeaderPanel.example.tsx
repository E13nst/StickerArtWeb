import React from 'react';
import { HeaderPanel } from './HeaderPanel';

/**
 * HeaderPanel Example
 * 
 * Пример использования компонента HeaderPanel
 * Компонент автоматически получает данные из stores:
 * - useTelegram() для информации о пользователе и аватара
 * - useProfileStore() для баланса ART
 */
export const HeaderPanelExample: React.FC = () => {
  return (
    <div style={{ 
      padding: '24px',
      background: 'var(--color-background)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      <div>
        <h2 style={{ color: 'var(--color-text)', marginBottom: '16px' }}>
          Header Panel
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
          Компонент отображается только для авторизованных пользователей.
          <br />
          Показывает аватар, баланс ART, кнопку пополнения и TON Connect.
        </p>
        
        <HeaderPanel />
      </div>

      <div style={{ marginTop: '32px' }}>
        <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>
          Использование
        </h3>
        <pre style={{
          background: 'var(--color-surface)',
          padding: '16px',
          borderRadius: '8px',
          color: 'var(--color-text)',
          overflow: 'auto'
        }}>
{`import { HeaderPanel } from '@/components/ui';

// Компонент не требует props
// Автоматически получает данные из stores
<HeaderPanel />`}
        </pre>
      </div>

      <div style={{ marginTop: '16px' }}>
        <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>
          Особенности
        </h3>
        <ul style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
          <li>Не требует props - читает данные из stores</li>
          <li>Отображается только если user !== null</li>
          <li>Использует useTelegram() для получения user и photo_url</li>
          <li>Использует useProfileStore() для получения artBalance</li>
          <li>Форматирует баланс с разделителями тысяч</li>
          <li>Показывает placeholder если аватар отсутствует</li>
          <li>Адаптивный дизайн для мобильных устройств</li>
        </ul>
      </div>

      <div style={{ marginTop: '16px' }}>
        <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>
          Структура
        </h3>
        <ul style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
          <li><strong>Avatar:</strong> Круглое изображение 46x46px (или placeholder с первой буквой имени)</li>
          <li><strong>Balance:</strong> Блок с текстом "X ART" и кнопкой пополнения (+)</li>
          <li><strong>Plus button:</strong> Кнопка 32x32px для пополнения баланса</li>
          <li><strong>Wallet button:</strong> Кнопка 45x48px для TON Connect (синяя)</li>
        </ul>
      </div>

      <div style={{ marginTop: '16px' }}>
        <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>
          Интеграция
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          Кнопки "Plus" и "Wallet" выводят сообщения в консоль.
          <br />
          Для полной интеграции необходимо:
        </p>
        <ul style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
          <li>Добавить модальное окно пополнения баланса (handlePlusClick)</li>
          <li>Интегрировать TON Connect SDK (handleWalletClick)</li>
        </ul>
      </div>
    </div>
  );
};
