import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useHapticFeedback } from './useHapticFeedback';

export type TransitionType = 'slide' | 'fade' | 'scale' | 'flip' | 'push' | 'cover';
export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

interface TransitionOptions {
  type: TransitionType;
  direction?: TransitionDirection;
  duration?: number;
  easing?: string;
  delay?: number;
}

interface PageTransitionState {
  isTransitioning: boolean;
  currentPage: string | null;
  nextPage: string | null;
  direction: TransitionDirection;
  type: TransitionType;
}

export const usePageTransitions = () => {
  const [state, setState] = useState<PageTransitionState>({
    isTransitioning: false,
    currentPage: null,
    nextPage: null,
    direction: 'right',
    type: 'slide'
  });

  const { hapticClick } = useHapticFeedback();
  const transitionTimeoutRef = useRef<NodeJS.Timeout>();

  // Выполнение перехода
  const transitionTo = useCallback(async (
    pageId: string,
    options: TransitionOptions = { type: 'slide' }
  ) => {
    const {
      type = 'slide',
      direction = 'right',
      duration = 300,
      easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
      delay = 0
    } = options;

    // Haptic feedback
    hapticClick();

    // Начало перехода
    setState(prev => ({
      ...prev,
      isTransitioning: true,
      nextPage: pageId,
      direction,
      type
    }));

    // Задержка перед началом анимации
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Ожидание завершения анимации
    await new Promise(resolve => {
      transitionTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isTransitioning: false,
          currentPage: pageId,
          nextPage: null
        }));
        resolve(void 0);
      }, duration);
    });
  }, [hapticClick]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    transitionTo,
    isTransitioning: state.isTransitioning
  };
};

// Компонент для анимированных переходов
interface AnimatedPageProps {
  pageId: string;
  isActive: boolean;
  isEntering: boolean;
  isExiting: boolean;
  transitionType: TransitionType;
  direction: TransitionDirection;
  duration: number;
  children: React.ReactNode;
  className?: string;
}

export const AnimatedPage: React.FC<AnimatedPageProps> = ({
  pageId,
  isActive,
  isEntering,
  isExiting,
  transitionType,
  direction,
  duration,
  children,
  className = ''
}) => {
  const getTransform = useCallback(() => {
    if (!isEntering && !isExiting) return 'translateX(0) translateY(0) scale(1)';
    
    const isHorizontal = direction === 'left' || direction === 'right';
    const isVertical = direction === 'up' || direction === 'down';
    
    switch (transitionType) {
      case 'slide':
        if (isHorizontal) {
          const translateX = direction === 'right' ? '100%' : '-100%';
          return isEntering ? `translateX(${translateX})` : 'translateX(0)';
        } else {
          const translateY = direction === 'down' ? '100%' : '-100%';
          return isEntering ? `translateY(${translateY})` : 'translateY(0)';
        }
      
      case 'scale':
        return isEntering ? 'scale(0.8)' : 'scale(1)';
      
      case 'fade':
        return 'translateX(0) translateY(0)';
      
      case 'flip':
        return isEntering ? 'rotateY(90deg)' : 'rotateY(0deg)';
      
      case 'push':
        if (isHorizontal) {
          const translateX = direction === 'right' ? '50%' : '-50%';
          return isEntering ? `translateX(${translateX})` : 'translateX(0)';
        } else {
          const translateY = direction === 'down' ? '50%' : '-50%';
          return isEntering ? `translateY(${translateY})` : 'translateY(0)';
        }
      
      case 'cover':
        if (isHorizontal) {
          const translateX = direction === 'right' ? '100%' : '-100%';
          return isEntering ? `translateX(${translateX})` : 'translateX(0)';
        } else {
          const translateY = direction === 'down' ? '100%' : '-100%';
          return isEntering ? `translateY(${translateY})` : 'translateY(0)';
        }
      
      default:
        return 'translateX(0) translateY(0)';
    }
  }, [isEntering, isExiting, direction, transitionType]);

  const getOpacity = useCallback(() => {
    if (transitionType === 'fade') {
      return isEntering ? 0 : 1;
    }
    return 1;
  }, [transitionType, isEntering]);

  const getZIndex = useCallback(() => {
    if (isEntering) return 2;
    if (isExiting) return 1;
    return isActive ? 2 : 0;
  }, [isEntering, isExiting, isActive]);

  return (
    <div
      key={pageId}
      className={`animated-page ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        transform: getTransform(),
        opacity: getOpacity(),
        zIndex: getZIndex(),
        transition: `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        overflow: 'hidden'
      }}
    >
      {children}
    </div>
  );
};

// Хук для управления стеком страниц
export const usePageStack = () => {
  const [pageStack, setPageStack] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<string | null>(null);

  const pushPage = useCallback((pageId: string) => {
    setPageStack(prev => [...prev, pageId]);
    setCurrentPage(pageId);
  }, []);

  const popPage = useCallback(() => {
    if (pageStack.length > 1) {
      const newStack = pageStack.slice(0, -1);
      setPageStack(newStack);
      setCurrentPage(newStack[newStack.length - 1]);
      return newStack[newStack.length - 1];
    }
    return null;
  }, [pageStack]);

  const replacePage = useCallback((pageId: string) => {
    setPageStack(prev => [...prev.slice(0, -1), pageId]);
    setCurrentPage(pageId);
  }, []);

  const clearStack = useCallback(() => {
    setPageStack([]);
    setCurrentPage(null);
  }, []);

  return {
    pageStack,
    currentPage,
    pushPage,
    popPage,
    replacePage,
    clearStack,
    canGoBack: pageStack.length > 1
  };
};

// Предустановленные конфигурации переходов
export const transitionPresets = {
  slideRight: { type: 'slide' as const, direction: 'right' as const, duration: 300 },
  slideLeft: { type: 'slide' as const, direction: 'left' as const, duration: 300 },
  slideUp: { type: 'slide' as const, direction: 'up' as const, duration: 300 },
  slideDown: { type: 'slide' as const, direction: 'down' as const, duration: 300 },
  fade: { type: 'fade' as const, direction: 'right' as const, duration: 250 },
  scale: { type: 'scale' as const, direction: 'right' as const, duration: 400 },
  flip: { type: 'flip' as const, direction: 'right' as const, duration: 500 },
  push: { type: 'push' as const, direction: 'right' as const, duration: 350 },
  cover: { type: 'cover' as const, direction: 'right' as const, duration: 400 }
};
