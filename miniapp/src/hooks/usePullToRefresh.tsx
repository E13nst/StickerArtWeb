import { useState, useCallback, useRef, FC } from 'react';
import { useHapticFeedback } from './useHapticFeedback';

interface PullToRefreshOptions {
  threshold?: number; // Минимальное расстояние для активации
  maxDistance?: number; // Максимальное расстояние
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  canRefresh: boolean;
}

export const usePullToRefresh = (options: PullToRefreshOptions) => {
  const {
    threshold = 80,
    maxDistance = 120,
    onRefresh,
    enabled = true
  } = options;

  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    canRefresh: false
  });

  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isScrolledToTop = useRef<boolean>(true);
  const { hapticClick, hapticSuccess } = useHapticFeedback();

  // Проверка, находится ли элемент в верхней части
  const checkScrollPosition = useCallback((element: HTMLElement) => {
    isScrolledToTop.current = element.scrollTop === 0;
  }, []);

  // Обработка начала касания
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing) return;

    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
    
    setState(prev => ({
      ...prev,
      isPulling: false,
      pullDistance: 0,
      canRefresh: false
    }));
  }, [enabled, state.isRefreshing]);

  // Обработка движения
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing || !isScrolledToTop.current) return;

    currentY.current = e.touches[0].clientY;
    const distance = Math.max(0, currentY.current - startY.current);

    if (distance > 0) {
      e.preventDefault(); // Предотвращаем скролл страницы
      
      const normalizedDistance = Math.min(distance, maxDistance);
      const canRefresh = normalizedDistance >= threshold;
      
      setState(prev => ({
        ...prev,
        isPulling: true,
        pullDistance: normalizedDistance,
        canRefresh
      }));

      // Haptic feedback при достижении порога
      if (canRefresh && !state.canRefresh) {
        hapticClick();
      }
    }
  }, [enabled, state.isRefreshing, state.canRefresh, threshold, maxDistance, hapticClick]);

  // Обработка окончания касания
  const handleTouchEnd = useCallback(async (_e: TouchEvent) => {
    if (!enabled || !state.isPulling) return;

    if (state.canRefresh && !state.isRefreshing) {
      setState(prev => ({
        ...prev,
        isRefreshing: true,
        isPulling: false
      }));

      hapticSuccess();

      try {
        await onRefresh();
      } catch (error) {
        console.warn('Ошибка обновления:', error);
      } finally {
        setState(prev => ({
          ...prev,
          isRefreshing: false,
          pullDistance: 0,
          canRefresh: false
        }));
      }
    } else {
      // Сброс без обновления
      setState(prev => ({
        ...prev,
        isPulling: false,
        pullDistance: 0,
        canRefresh: false
      }));
    }
  }, [enabled, state.isPulling, state.canRefresh, state.isRefreshing, onRefresh, hapticSuccess]);

  // Привязка обработчиков к элементу
  const attachToElement = useCallback((element: HTMLElement) => {
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('scroll', () => checkScrollPosition(element));

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('scroll', () => checkScrollPosition(element));
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, checkScrollPosition]);

  // Вычисление прогресса для анимации
  const progress = Math.min(state.pullDistance / threshold, 1);
  const rotation = progress * 180; // Поворот стрелки
  const scale = 0.8 + (progress * 0.2); // Масштаб иконки

  return {
    ...state,
    progress,
    rotation,
    scale,
    attachToElement,
    isEnabled: enabled
  };
};

// Компонент индикатора Pull-to-Refresh
interface PullToRefreshIndicatorProps {
  state: PullToRefreshState;
  progress: number;
  rotation: number;
  scale: number;
}

export const PullToRefreshIndicator: FC<PullToRefreshIndicatorProps> = ({
  state,
  progress,
  rotation,
  scale
}) => {
  if (!state.isPulling && !state.isRefreshing) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        transform: `translateY(${state.pullDistance - 60}px)`,
        transition: state.isRefreshing ? 'transform 0.3s ease' : 'none',
        zIndex: 'var(--z-overlay, 400)'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {/* Иконка */}
        <div
          style={{
            transform: `rotate(${rotation}deg) scale(${scale})`,
            transition: 'transform 0.2s ease',
            fontSize: '20px'
          }}
        >
          {state.isRefreshing ? (
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--color-text-secondary)',
                borderTop: '2px solid var(--color-button)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
          ) : (
            '⬇️'
          )}
        </div>

        {/* Текст */}
        <div
          style={{
            fontSize: '12px',
            color: state.canRefresh 
              ? 'var(--color-button)' 
              : 'var(--color-text-secondary)',
            fontWeight: '500',
            opacity: progress
          }}
        >
          {state.isRefreshing 
            ? 'Обновление...' 
            : state.canRefresh 
              ? 'Отпустите для обновления' 
              : 'Потяните для обновления'
          }
        </div>
      </div>
    </div>
  );
};
