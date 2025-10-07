import { useEffect } from 'react';

// Хук для обработки безопасных зон Telegram
export function useTgSafeArea() {
  useEffect(() => {
    // Устанавливаем CSS переменные для safe areas
    const setSafeAreaInsets = () => {
      const root = document.documentElement;
      
      // Получаем значения из CSS env() или устанавливаем по умолчанию
      const top = getComputedStyle(root).getPropertyValue('env(safe-area-inset-top)') || '0px';
      const bottom = getComputedStyle(root).getPropertyValue('env(safe-area-inset-bottom)') || '0px';
      const left = getComputedStyle(root).getPropertyValue('env(safe-area-inset-left)') || '0px';
      const right = getComputedStyle(root).getPropertyValue('env(safe-area-inset-right)') || '0px';
      
      // Устанавливаем CSS переменные для использования в компонентах
      root.style.setProperty('--safe-area-inset-top', top);
      root.style.setProperty('--safe-area-inset-bottom', bottom);
      root.style.setProperty('--safe-area-inset-left', left);
      root.style.setProperty('--safe-area-inset-right', right);
    };

    // Устанавливаем при монтировании
    setSafeAreaInsets();

    // Слушаем изменения ориентации
    const handleOrientationChange = () => {
      setTimeout(setSafeAreaInsets, 100); // Небольшая задержка для обновления
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);
}
