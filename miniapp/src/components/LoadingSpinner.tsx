import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Загрузка...' 
}) => {
  return (
    <div className="tg-spinner">
      <div className="tg-spinner__loader"></div>
      {message && <p className="tg-spinner__message">{message}</p>}
    </div>
  );
};

// CSS для spinner
const styles = `
.tg-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--tg-spacing-6) var(--tg-spacing-4);
  min-height: 200px;
}

.tg-spinner__loader {
  width: 40px;
  height: 40px;
  border: 3px solid var(--tg-theme-secondary-bg-color);
  border-top-color: var(--tg-theme-button-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.tg-spinner__message {
  margin-top: var(--tg-spacing-3);
  font-size: var(--tg-font-size-m);
  color: var(--tg-theme-hint-color);
  text-align: center;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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
