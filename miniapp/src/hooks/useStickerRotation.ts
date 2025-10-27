import { useState, useEffect, useCallback } from 'react';

interface UseStickerRotationProps {
  stickersCount: number;
  autoRotateInterval?: number;
  hoverRotateInterval?: number;
  isHovered?: boolean;
  isVisible?: boolean;
}

export const useStickerRotation = ({
  stickersCount,
  autoRotateInterval = 2333, // 2333 ≈ 3000/φ (золотое сечение)
  hoverRotateInterval = 618, // Число Фибоначчи
  isHovered = false,
  isVisible = true
}: UseStickerRotationProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Сброс индекса при изменении количества стикеров
  useEffect(() => {
    if (currentIndex >= stickersCount) {
      setCurrentIndex(0);
    }
  }, [stickersCount, currentIndex]);

  // Автоматическая ротация
  useEffect(() => {
    if (stickersCount <= 1 || !isVisible) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % stickersCount);
    }, isHovered ? hoverRotateInterval : autoRotateInterval);

    return () => clearInterval(interval);
  }, [stickersCount, isVisible, isHovered, autoRotateInterval, hoverRotateInterval]);

  // Ручное управление
  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % stickersCount);
  }, [stickersCount]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + stickersCount) % stickersCount);
  }, [stickersCount]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < stickersCount) {
      setCurrentIndex(index);
    }
  }, [stickersCount]);

  return {
    currentIndex,
    goToNext,
    goToPrevious,
    goToIndex
  };
};
