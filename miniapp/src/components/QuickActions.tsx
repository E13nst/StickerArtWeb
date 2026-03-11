import { useState, useCallback, useEffect, FC } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  color?: string;
  shortcut?: string; // Клавиатурное сокращение
  condition?: () => boolean; // Условие показа
}

interface QuickActionsProps {
  actions: QuickAction[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

export const QuickActions: FC<QuickActionsProps> = ({
  actions,
  position = 'bottom-right',
  isExpanded: controlledExpanded,
  onToggle
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const { hapticClick, hapticSuccess } = useHapticFeedback();

  // Управление состоянием
  const expanded = controlledExpanded !== undefined ? controlledExpanded : isExpanded;
  const setExpanded = useCallback((value: boolean) => {
    if (controlledExpanded === undefined) {
      setIsExpanded(value);
    }
    onToggle?.(value);
  }, [controlledExpanded, onToggle]);

  // Фильтруем действия по условиям
  const visibleActions = actions.filter(action => 
    !action.condition || action.condition()
  );

  // Обработка клика по действию
  const handleActionClick = useCallback((action: QuickAction) => {
    hapticSuccess();
    action.action();
    setExpanded(false);
  }, [hapticSuccess, setExpanded]);

  // Обработка переключения
  const handleToggle = useCallback(() => {
    hapticClick();
    setExpanded(!expanded);
  }, [expanded, setExpanded, hapticClick]);

  // Клавиатурные сокращения
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const action = visibleActions.find(a => a.shortcut === e.key);
      if (action) {
        e.preventDefault();
        handleActionClick(action);
      }
      
      // Escape для закрытия
      if (e.key === 'Escape' && expanded) {
        setExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visibleActions, handleActionClick, expanded, setExpanded]);

  // Позиционирование
  const positionStyles = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' }
  };

  const positionStyle = positionStyles[position];

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyle,
        zIndex: 'var(--z-ui-controls, 200)',
        display: 'flex',
        flexDirection: position.includes('bottom') ? 'column-reverse' : 'column',
        alignItems: position.includes('right') ? 'flex-end' : 'flex-start',
        gap: '8px'
      }}
    >
      {/* Действия */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: position.includes('bottom') ? 'column-reverse' : 'column',
            gap: '8px',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {visibleActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              onMouseEnter={() => setHoveredAction(action.id)}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                backgroundColor: hoveredAction === action.id 
                  ? 'var(--color-button)' 
                  : 'var(--color-surface)',
                color: hoveredAction === action.id 
                  ? 'var(--color-button-text)' 
                  : 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 4px 12px var(--color-shadow)',
                transition: 'all 0.2s ease',
                transform: hoveredAction === action.id ? 'scale(1.05)' : 'scale(1)',
                minWidth: '120px',
                justifyContent: 'flex-start'
              }}
            >
              <span style={{ fontSize: '16px' }}>{action.icon}</span>
              <span>{action.label}</span>
              {action.shortcut && (
                <span style={{
                  fontSize: '10px',
                  opacity: 0.7,
                  marginLeft: 'auto'
                }}>
                  {action.shortcut}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Главная кнопка */}
      <button
        onClick={handleToggle}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: expanded 
            ? 'var(--color-button)' 
            : 'var(--color-surface)',
          color: expanded 
            ? 'var(--color-button-text)' 
            : 'var(--color-text)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          boxShadow: '0 4px 12px var(--color-shadow)',
          transition: 'all 0.3s ease',
          transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)'
        }}
      >
        {expanded ? '✕' : '⚡'}
      </button>

      {/* CSS анимации */}
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(${position.includes('bottom') ? '20px' : '-20px'});
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

// Предустановленные наборы действий
export const createGalleryQuickActions = (
  onSearch: () => void,
  onFilter: () => void,
  onRandom: () => void,
  onFavorites: () => void
): QuickAction[] => [
  {
    id: 'search',
    label: 'Поиск',
    icon: '🔍',
    action: onSearch,
    shortcut: 's'
  },
  {
    id: 'filter',
    label: 'Фильтры',
    icon: '🎛️',
    action: onFilter,
    shortcut: 'f'
  },
  {
    id: 'random',
    label: 'Случайный',
    icon: '🎲',
    action: onRandom,
    shortcut: 'r'
  },
  {
    id: 'favorites',
    label: 'Избранное',
    icon: '❤️',
    action: onFavorites,
    shortcut: 'l'
  }
];
