import { ReactNode, useEffect, FC } from 'react';
import { useTelegram } from '../hooks/useTelegram';

interface TelegramLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export const TelegramLayout: FC<TelegramLayoutProps> = ({
  children,
  title,
  showBackButton = false,
  onBackClick,
}) => {
  const { tg } = useTelegram();

  useEffect(() => {
    if (!tg) return;

    // Управление Back кнопкой
    if (showBackButton && onBackClick) {
      tg.BackButton.show();
      tg.BackButton.onClick(onBackClick);
    } else {
      tg.BackButton.hide();
    }

    // Устанавливаем заголовок через Telegram
    if (title && document.title !== title) {
      document.title = title;
    }

    // Cleanup
    return () => {
      if (tg.BackButton) {
        tg.BackButton.hide();
      }
    };
  }, [tg, showBackButton, onBackClick, title]);

  return (
    <div className="tg-layout">
      {title && (
        <div className="tg-layout__header">
          <h1 className="tg-layout__title">{title}</h1>
        </div>
      )}
      <div className="tg-layout__content">
        {children}
      </div>
    </div>
  );
};

// CSS для layout (упрощённый, без влияния на scroll)
const styles = `
.tg-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.tg-layout__header {
  flex-shrink: 0;
  padding: var(--tg-spacing-4) var(--tg-spacing-4) var(--tg-spacing-3);
  background: var(--tg-theme-bg-color);
  border-bottom: 1px solid var(--tg-theme-secondary-bg-color);
}

.tg-layout__title {
  font-size: var(--tg-font-size-xxl);
  font-weight: 600;
  color: var(--tg-theme-text-color);
  margin: 0;
  line-height: 1.2;
}

.tg-layout__content {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 0;
  margin: 0;
  position: relative;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'tg-layout-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

