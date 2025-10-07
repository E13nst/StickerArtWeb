import { useEffect } from 'react';

// Хук для градиентного фона с изменением оттенка при скролле
export function useScrollHue(minHue: number = 190, maxHue: number = 255) {
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = Math.min(scrollY / maxScroll, 1);
      
      // Вычисляем hue на основе прогресса скролла
      const currentHue = minHue + (maxHue - minHue) * scrollProgress;
      
      // Обновляем CSS переменную для hue
      document.documentElement.style.setProperty('--scroll-hue', `${currentHue}deg`);
    };

    // Устанавливаем начальное значение
    document.documentElement.style.setProperty('--scroll-hue', `${minHue}deg`);

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [minHue, maxHue]);
}
