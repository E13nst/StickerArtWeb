import { useEffect, useState } from 'react';

// Функция для извлечения доминирующего цвета из градиента
const extractColorFromGradient = (gradient: string): string => {
  // Извлекаем первый цвет из градиента
  const match = gradient.match(/#[0-9A-Fa-f]{6}/);
  return match ? match[0] : '#000000';
};

// Функция для получения цвета на основе времени суток
const getTimeBasedColor = (hour: number): string => {
  // Утро (6-12): более светлые цвета
  if (hour >= 6 && hour < 12) {
    return '#FF944D'; // Оранжевый, более светлый
  }
  // День (12-18): яркие цвета
  if (hour >= 12 && hour < 18) {
    return '#FF6700'; // Оранжевый, яркий
  }
  // Вечер (18-22): переходные цвета
  if (hour >= 18 && hour < 22) {
    return '#3B1D73'; // Фиолетовый
  }
  // Ночь (22-6): темные цвета
  return '#000000'; // Черный
};

// Функция для корректировки цвета на основе сетевого подключения
const adjustColorForNetwork = (baseColor: string, isOnline: boolean): string => {
  if (!isOnline) {
    // Если нет интернета - делаем цвет более серым/тусклым
    return '#666666';
  }
  return baseColor;
};

interface UseHeaderColorOptions {
  currentSlideBg?: string;
  onColorChange?: (color: string) => void;
}

export const useHeaderColor = (options: UseHeaderColorOptions = {}) => {
  const { currentSlideBg, onColorChange } = options;
  const [headerColor, setHeaderColor] = useState<string>('#000000');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Отслеживание сетевого подключения
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Обновление цвета при изменении слайда, времени или сети
  useEffect(() => {
    const updateColor = () => {
      const hour = new Date().getHours();
      
      let baseColor: string;
      
      // Если есть текущий слайд - используем его цвет
      if (currentSlideBg) {
        baseColor = extractColorFromGradient(currentSlideBg);
      } else {
        // Иначе используем цвет на основе времени суток
        baseColor = getTimeBasedColor(hour);
      }
      
      // Корректируем цвет на основе сетевого подключения
      const finalColor = adjustColorForNetwork(baseColor, isOnline);
      
      setHeaderColor(finalColor);
      
      // Вызываем callback если он есть
      if (onColorChange) {
        onColorChange(finalColor);
      }
    };

    updateColor();

    // Обновляем цвет каждую минуту (для изменения по времени)
    const interval = setInterval(updateColor, 60000);

    return () => clearInterval(interval);
  }, [currentSlideBg, isOnline, onColorChange]);

  return headerColor;
};

