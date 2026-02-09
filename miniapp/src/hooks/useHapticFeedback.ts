import { useCallback } from 'react';
import WebApp from '@twa-dev/sdk';

/**
 * Хук для работы с тактильными откликами (haptic feedback) Telegram WebApp
 * Предоставляет удобные методы для различных типов вибрации
 */
export const useHapticFeedback = () => {
  const isAvailable = WebApp?.HapticFeedback !== undefined;

  // Лёгкая вибрация при клике на элементы
  const hapticClick = useCallback(() => {
    if (isAvailable) {
      try {
        WebApp.HapticFeedback.impactOccurred('light');
      } catch (e) {
        console.warn('Haptic feedback error:', e);
      }
    }
  }, [isAvailable]);

  // Средняя вибрация для обычных действий
  const hapticImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    if (isAvailable) {
      try {
        WebApp.HapticFeedback.impactOccurred(style);
      } catch (e) {
        console.warn('Haptic feedback error:', e);
      }
    }
  }, [isAvailable]);

  // Вибрация для успешных действий
  const hapticSuccess = useCallback(() => {
    if (isAvailable) {
      try {
        WebApp.HapticFeedback.notificationOccurred('success');
      } catch (e) {
        console.warn('Haptic feedback error:', e);
      }
    }
  }, [isAvailable]);

  // Вибрация для предупреждений
  const hapticWarning = useCallback(() => {
    if (isAvailable) {
      try {
        WebApp.HapticFeedback.notificationOccurred('warning');
      } catch (e) {
        console.warn('Haptic feedback error:', e);
      }
    }
  }, [isAvailable]);

  // Вибрация для ошибок
  const hapticError = useCallback(() => {
    if (isAvailable) {
      try {
        WebApp.HapticFeedback.notificationOccurred('error');
      } catch (e) {
        console.warn('Haptic feedback error:', e);
      }
    }
  }, [isAvailable]);

  // Вибрация для лайков/избранного
  const hapticLike = useCallback(() => {
    if (isAvailable) {
      try {
        WebApp.HapticFeedback.impactOccurred('rigid');
      } catch (e) {
        console.warn('Haptic feedback error:', e);
      }
    }
  }, [isAvailable]);

  // Изменение выбора (selection)
  const hapticSelection = useCallback(() => {
    if (isAvailable) {
      try {
        WebApp.HapticFeedback.selectionChanged();
      } catch (e) {
        console.warn('Haptic feedback error:', e);
      }
    }
  }, [isAvailable]);

  return {
    isAvailable,
    hapticClick,
    hapticImpact,
    hapticSuccess,
    hapticWarning,
    hapticError,
    hapticLike,
    hapticSelection
  };
};
