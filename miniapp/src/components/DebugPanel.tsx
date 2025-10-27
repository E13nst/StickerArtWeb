import React, { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useStickerStore } from '../store/useStickerStore';
import { apiClient } from '../api/client';
import { getBuildInfo, formatBuildTime } from '../utils/buildInfo';

interface DebugPanelProps {
  initData: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ initData }) => {
  const { tg, isInTelegramApp, isMockMode } = useTelegram();
  const { authStatus, authError, authLoading } = useStickerStore();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const buildInfo = getBuildInfo();

  // Функция для парсинга initData
  const parseInitData = (initData: string | null) => {
    if (!initData) return null;
    
    try {
      const params = new URLSearchParams(initData);
      const parsed: Record<string, string> = {};
      
      for (const [key, value] of params.entries()) {
        parsed[key] = value;
      }
      
      return {
        raw: initData,
        parsed,
        length: initData.length,
        hasQueryId: initData.includes('query_id'),
        isTestData: initData.includes('query_id=test'),
        timestamp: initData.includes('auth_date') ? 
          new Date(parseInt(params.get('auth_date') || '0') * 1000).toISOString() : 
          'unknown'
      };
    } catch (error) {
      return {
        raw: initData,
        error: 'Failed to parse initData',
        length: initData.length
      };
    }
  };

  // Функция для получения информации о заголовках API
  const getApiHeadersInfo = () => {
    try {
      const headers = apiClient.getHeaders();
      return {
        baseURL: apiClient.getBaseURL(),
        timeout: apiClient.getTimeout(),
        headers: {
          'Content-Type': headers['Content-Type'] || 'not set',
          'Accept': headers['Accept'] || 'not set',
          'X-Telegram-Init-Data': headers['X-Telegram-Init-Data'] ? 'present' : 'missing'
        },
        hasAuthHeader: !!headers['X-Telegram-Init-Data']
      };
    } catch (error) {
      return {
        error: 'Failed to get API headers info',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

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
    <div 
      className="tg-debug-panel"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 72, zIndex: 900 }}
    >
      <button 
        className="tg-debug-panel__toggle"
        onClick={handleToggle}
      >
        🔍 Debug Info {expanded ? '▼' : '▶'}
      </button>
      
      {expanded && (
        <div className="tg-debug-panel__content">
          {/* Информация о сборке */}
          <div className="tg-debug-panel__section">
            <div className="tg-debug-panel__info">
              <span className="tg-debug-panel__label">Сборка:</span>
              <span className="tg-debug-panel__value">{formatBuildTime(buildInfo.buildTime)}</span>
            </div>
          </div>

          {/* Состояние приложения */}
          <div className="tg-debug-panel__section">
            <div className="tg-debug-panel__info">
              <span className="tg-debug-panel__label">Состояние приложения:</span>
            </div>
            <div className="tg-debug-panel__data">
              <code>{JSON.stringify({
                isInTelegramApp,
                isMockMode,
                authLoading,
                timestamp: new Date().toISOString()
              }, null, 2)}</code>
            </div>
          </div>

          {/* Статус авторизации */}
          <div className="tg-debug-panel__section">
            <div className="tg-debug-panel__info">
              <span className="tg-debug-panel__label">Статус авторизации:</span>
            </div>
            <div className="tg-debug-panel__data">
              <code>{JSON.stringify({
                authStatus,
                authError,
                authLoading
              }, null, 2)}</code>
            </div>
          </div>

          {/* InitData детальный анализ */}
          <div className="tg-debug-panel__section">
            <div className="tg-debug-panel__info">
              <span className="tg-debug-panel__label">InitData (детальный анализ):</span>
            </div>
            <div className="tg-debug-panel__data">
              <code>{JSON.stringify(parseInitData(initData), null, 2)}</code>
            </div>
          </div>

          {/* API заголовки */}
          <div className="tg-debug-panel__section">
            <div className="tg-debug-panel__info">
              <span className="tg-debug-panel__label">API заголовки и конфигурация:</span>
            </div>
            <div className="tg-debug-panel__data">
              <code>{JSON.stringify(getApiHeadersInfo(), null, 2)}</code>
            </div>
          </div>

          {/* Ошибки авторизации */}
          {authError && (
            <div className="tg-debug-panel__section">
              <div className="tg-debug-panel__info">
                <span className="tg-debug-panel__label" style={{ color: '#ff6b6b' }}>Ошибка авторизации:</span>
              </div>
              <div className="tg-debug-panel__data" style={{ border: '1px solid #ff6b6b' }}>
                <code style={{ color: '#ff6b6b' }}>{authError}</code>
              </div>
            </div>
          )}

          {/* InitData сырые данные */}
          <div className="tg-debug-panel__section">
            <div className="tg-debug-panel__info">
              <span className="tg-debug-panel__label">InitData (сырые данные):</span>
              <span className="tg-debug-panel__value">{initData.length} символов</span>
            </div>
            
            <div className="tg-debug-panel__data">
              <code>{initData}</code>
            </div>
            
            <button 
              className="tg-button tg-button--primary tg-debug-panel__copy"
              onClick={handleCopy}
            >
              {copied ? '✅ Скопировано!' : '📋 Копировать InitData'}
            </button>
            
            <div className="tg-debug-panel__hint">
              💡 Используйте для заголовка: <code>X-Telegram-Init-Data</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
