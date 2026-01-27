import React, { useState, useRef, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useStickerStore } from '../store/useStickerStore';
import { apiClient } from '../api/client';
import { getBuildInfo, formatBuildTime } from '../utils/buildInfo';

interface DebugPanelProps {
  initData?: string;
}

// Пресеты темы в стиле Telegram WebApp
const lightTheme = {
  bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#999999',
  link_color: '#2481cc',
  button_color: '#2481cc',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f8f9fa',
  border_color: '#e0e0e0',
  shadow_color: 'rgba(0, 0, 0, 0.1)',
  overlay_color: 'rgba(0, 0, 0, 0.7)',
};

const darkTheme = {
  bg_color: '#18222d',
  text_color: '#ffffff',
  hint_color: '#708499',
  link_color: '#6ab2f2',
  button_color: '#5288c1',
  button_text_color: '#ffffff',
  secondary_bg_color: '#131415',
  border_color: '#2a3441',
  shadow_color: 'rgba(0, 0, 0, 0.3)',
  overlay_color: 'rgba(0, 0, 0, 0.8)',
};

// Функция для конвертации hex в RGB
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
};

function applyTheme(theme: typeof lightTheme, scheme: 'light' | 'dark') {
  const root = document.documentElement;
  const body = document.body;
  
  // Основные переменные темы (как в StixlyThemeToggle)
  root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
  root.style.setProperty('--tg-theme-text-color', theme.text_color);
  root.style.setProperty('--tg-theme-hint-color', theme.hint_color);
  root.style.setProperty('--tg-theme-button-color', theme.button_color);
  root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
  root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color);
  root.style.setProperty('--tg-theme-link-color', theme.link_color);
  root.style.setProperty('--tg-theme-border-color', theme.border_color);
  root.style.setProperty('--tg-theme-shadow-color', theme.shadow_color);
  root.style.setProperty('--tg-theme-overlay-color', theme.overlay_color);
  
  // RGB-переменные (дополнительно для rgba() использования)
  root.style.setProperty('--tg-theme-bg-color-rgb', hexToRgb(theme.bg_color));
  root.style.setProperty('--tg-theme-text-color-rgb', hexToRgb(theme.text_color));
  root.style.setProperty('--tg-theme-button-color-rgb', hexToRgb(theme.button_color));
  root.style.setProperty('--tg-theme-error-color-rgb', '244, 67, 54');
  
  body.style.backgroundColor = theme.bg_color;
  body.style.color = theme.text_color;
  
  if (scheme === 'dark') {
    root.classList.add('tg-dark-theme');
    root.classList.remove('tg-light-theme');
  } else {
    root.classList.add('tg-light-theme');
    root.classList.remove('tg-dark-theme');
  }
  
  // Сохраняем тему
  try {
    localStorage.setItem('stixly_tg_theme', JSON.stringify({ scheme, params: theme }));
  } catch {}
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ initData }) => {
  const { tg, isInTelegramApp, isMockMode } = useTelegram();
  const { authStatus, authError, authLoading } = useStickerStore();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('stixly_tg_theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.scheme === 'dark';
      }
    } catch {}
    return document.documentElement.classList.contains('tg-dark-theme');
  });
  const buildInfo = getBuildInfo();
  
  // Refs для обработки долгого нажатия
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const themeToggleHandledRef = useRef(false);

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
    if (!initData) {
      console.warn('InitData отсутствует, копирование невозможно');
      return;
    }
    
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

  // Обработка переключения темы
  const handleThemeToggle = () => {
    const next = !isDark;
    setIsDark(next);
    const scheme = next ? 'dark' : 'light';
    const params = next ? darkTheme : lightTheme;
    applyTheme(params, scheme);
    
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
  };

  // Обработка долгого нажатия (2 секунды)
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    isLongPressRef.current = false;
    themeToggleHandledRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setExpanded(true);
      
      // Haptic feedback для долгого нажатия
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }
    }, 2000);
  };

  const handleTouchEnd = () => {
    const wasLongPress = isLongPressRef.current;
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // Если было долгое нажатие, не переключаем тему
    if (wasLongPress) {
      isLongPressRef.current = false;
      themeToggleHandledRef.current = true;
      return;
    }
    
    // Если не было долгого нажатия - переключаем тему
    if (!themeToggleHandledRef.current) {
      themeToggleHandledRef.current = true;
      handleThemeToggle();
    }
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isLongPressRef.current = false;
    themeToggleHandledRef.current = false;
  };

  // Обработка мыши для десктопа
  const handleMouseDown = (e: React.MouseEvent) => {
    e.currentTarget.style.transform = 'scale(0.95)';
    handleTouchStart(e);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.currentTarget.style.transform = 'scale(1.05)';
    handleTouchEnd();
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.currentTarget.style.transform = 'scale(1)';
    handleTouchCancel();
  };
  
  // Обработка клика (для быстрого клика без долгого нажатия)
  const handleClick = (e: React.MouseEvent) => {
    // Если было долгое нажатие, не переключаем тему
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
      themeToggleHandledRef.current = true;
      return;
    }
    
    // Если тема уже была переключена через touch/mouse события, не делаем это снова
    if (themeToggleHandledRef.current) {
      themeToggleHandledRef.current = false;
      return;
    }
    
    // Если таймер был отменен (быстрый клик) - переключаем тему
    if (!longPressTimerRef.current) {
      themeToggleHandledRef.current = true;
      handleThemeToggle();
    }
  };

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <button 
        className="tg-debug-panel__toggle tg-debug-panel__toggle--compact"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={(e) => handleTouchEnd(e)}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        title={isDark ? 'Переключить на светлую тему (удерживайте 2 сек для Debug Info)' : 'Переключить на тёмную тему (удерживайте 2 сек для Debug Info)'}
        style={{
          position: 'fixed',
          left: 'calc(100vw * 0.012)',
          bottom: 'calc(100vw * 0.012)',
          zIndex: 'var(--z-ui-controls, 200)',
          width: '28px',
          height: '28px',
          minWidth: '28px',
          minHeight: '28px',
          maxWidth: '28px',
          maxHeight: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          border: 'none',
          borderRadius: '50%',
          backgroundColor: 'rgba(var(--tg-theme-secondary-bg-color-rgb, 128, 128, 128), 0.3)',
          color: 'var(--tg-theme-text-color)',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
          lineHeight: 1,
          overflow: 'hidden',
          opacity: 0.5,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(var(--tg-theme-button-color-rgb, 128, 128, 128), 0.6)';
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.opacity = '0.8';
        }}
      >
        <span style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          fontSize: '14px',
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'none',
          flexShrink: 0,
        }}>
          {isDark ? '☀️' : '🌙'}
        </span>
      </button>
      
      {expanded && (
        <>
          {/* Overlay для закрытия по клику вне окна */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 'var(--z-dropdown, 300)',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
            onClick={() => setExpanded(false)}
          />
          <div 
            className="tg-debug-panel__content"
            style={{
              position: 'fixed',
              left: 'calc(100vw * 0.024)',
              right: 'calc(100vw * 0.024)',
              bottom: 'calc(28px + 12px)', // высота кнопки + зазор
              borderRadius: 'calc(100vw * 0.04)',
              boxShadow: '0 4px 16px var(--tg-theme-shadow-color)',
              zIndex: 'var(--z-overlay, 400)', // выше overlay для взаимодействия
              background: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 98%, transparent)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
              <code>{JSON.stringify(parseInitData(initData || null), null, 2)}</code>
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
              <span className="tg-debug-panel__value">{initData ? `${initData.length} символов` : 'отсутствует'}</span>
            </div>
            
            <div className="tg-debug-panel__data">
              <code>{initData || 'InitData не доступен'}</code>
            </div>
            
            {initData && (
              <>
                <button 
                  className="tg-button tg-button--primary tg-debug-panel__copy"
                  onClick={handleCopy}
                >
                  {copied ? '✅ Скопировано!' : '📋 Копировать InitData'}
                </button>
                
                <div className="tg-debug-panel__hint">
                  💡 Используйте для заголовка: <code>X-Telegram-Init-Data</code>
                </div>
              </>
            )}
          </div>
          </div>
        </>
      )}
    </>
  );
};
