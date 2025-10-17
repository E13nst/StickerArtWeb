import React, { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';

interface DebugPanelProps {
  initData: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ initData }) => {
  const { tg } = useTelegram();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(initData);
      setCopied(true);
      
      // Haptic feedback
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = initData;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err2) {
        console.error('Fallback copy failed:', err2);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
  };

  if (!initData) {
    return null;
  }

  return (
    <div className="tg-debug-panel">
      <button 
        className="tg-debug-panel__toggle"
        onClick={handleToggle}
      >
        🔍 InitData для API {expanded ? '▼' : '▶'}
      </button>
      
      {expanded && (
        <div className="tg-debug-panel__content">
          <div className="tg-debug-panel__info">
            <span className="tg-debug-panel__label">Длина:</span>
            <span className="tg-debug-panel__value">{initData.length} символов</span>
          </div>
          
          <div className="tg-debug-panel__data">
            <code>{initData}</code>
          </div>
          
          <button 
            className="tg-button tg-button--primary tg-debug-panel__copy"
            onClick={handleCopy}
          >
            {copied ? '✅ Скопировано!' : '📋 Копировать'}
          </button>
          
          <div className="tg-debug-panel__hint">
            💡 Используйте для заголовка: <code>X-Telegram-Init-Data</code>
          </div>
        </div>
      )}
    </div>
  );
};
