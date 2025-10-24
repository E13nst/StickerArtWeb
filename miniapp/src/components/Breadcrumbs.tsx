import React, { useState, useCallback } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface BreadcrumbItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  data?: any; // Дополнительные данные для контекста
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  maxItems?: number;
  showHome?: boolean;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onNavigate,
  maxItems = 3,
  showHome = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { hapticClick } = useHapticFeedback();

  // Обработка клика по элементу
  const handleItemClick = useCallback((item: BreadcrumbItem) => {
    hapticClick();
    onNavigate(item.path);
  }, [onNavigate, hapticClick]);

  // Обработка разворачивания/сворачивания
  const handleToggle = useCallback(() => {
    hapticClick();
    setIsExpanded(!isExpanded);
  }, [isExpanded, hapticClick]);

  // Определяем видимые элементы
  const visibleItems = isExpanded ? items : items.slice(-maxItems);
  const hiddenCount = items.length - maxItems;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '8px 0',
      overflow: 'auto',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      {/* Домой */}
      {showHome && (
        <button
          onClick={() => handleItemClick({ id: 'home', label: 'Главная', path: '/' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 8px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            border: '1px solid var(--tg-theme-border-color)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--tg-theme-text-color)',
            transition: 'all 0.2s ease'
          }}
        >
          🏠 Главная
        </button>
      )}

      {/* Разделитель */}
      {showHome && items.length > 0 && (
        <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: '12px' }}>›</span>
      )}

      {/* Кнопка "..." для скрытых элементов */}
      {!isExpanded && hiddenCount > 0 && (
        <>
          <button
            onClick={handleToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 8px',
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              border: '1px solid var(--tg-theme-border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--tg-theme-hint-color)',
              transition: 'all 0.2s ease'
            }}
          >
            ⋯ {hiddenCount}
          </button>
          <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: '12px' }}>›</span>
        </>
      )}

      {/* Видимые элементы */}
      {visibleItems.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && (
            <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: '12px' }}>›</span>
          )}
          
          <button
            onClick={() => handleItemClick(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 8px',
              backgroundColor: index === visibleItems.length - 1 
                ? 'var(--tg-theme-button-color)' 
                : 'var(--tg-theme-secondary-bg-color)',
              border: '1px solid var(--tg-theme-border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: index === visibleItems.length - 1 
                ? 'var(--tg-theme-button-text-color)' 
                : 'var(--tg-theme-text-color)',
              transition: 'all 0.2s ease',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={item.label}
          >
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        </React.Fragment>
      ))}

      {/* Кнопка сворачивания */}
      {isExpanded && (
        <button
          onClick={handleToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 8px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            border: '1px solid var(--tg-theme-border-color)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--tg-theme-hint-color)',
            transition: 'all 0.2s ease'
          }}
        >
          ‹ Свернуть
        </button>
      )}
    </div>
  );
};

// Хук для управления историей навигации
export const useNavigationHistory = () => {
  const [history, setHistory] = useState<BreadcrumbItem[]>([]);

  const addToHistory = useCallback((item: BreadcrumbItem) => {
    setHistory(prev => {
      // Удаляем дубликаты
      const filtered = prev.filter(h => h.id !== item.id);
      return [...filtered, item];
    });
  }, []);

  const removeFromHistory = useCallback((itemId: string) => {
    setHistory(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      return newHistory[newHistory.length - 1];
    }
    return null;
  }, [history]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    goBack
  };
};
