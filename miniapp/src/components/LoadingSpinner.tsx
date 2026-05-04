import { FC } from 'react';
import { Quantum } from '@/components/ui/Quantum';

interface LoadingSpinnerProps {
  message?: string;
  /** Use 'quantum' variant for in-page process indicators (generating, uploading).
   *  Default 'pulsar' is for full-page / layout-level loading screens. */
  variant?: 'pulsar' | 'quantum';
  size?: number;
}

export const LoadingSpinner: FC<LoadingSpinnerProps> = ({
  message = 'Загрузка...',
  size = 56,
}) => (
  <div className="tg-spinner">
    <Quantum size={size} />
    {message && <p className="tg-spinner__message">{message}</p>}
  </div>
);

// Minimal inline styles — only layout, no animation (animation lives in Pulsar.css)
const styles = `
.tg-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--tg-spacing-6, 18px) var(--tg-spacing-4, 12px);
  min-height: 200px;
  gap: var(--tg-spacing-4, 12px);
}

.tg-spinner__message {
  margin: 0;
  font-size: var(--tg-font-size-s, 14px);
  color: var(--color-text-secondary, #8a8a8a);
  text-align: center;
  letter-spacing: 0.01em;
}
`;

if (typeof document !== 'undefined') {
  const styleId = 'tg-spinner-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}
