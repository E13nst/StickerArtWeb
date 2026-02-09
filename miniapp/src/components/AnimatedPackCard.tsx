import { useState, useEffect, FC } from 'react';
import { PackCard } from './PackCard';

interface AnimatedPackCardProps {
  pack: any;
  onClick?: (packId: string) => void;
  delay?: number; // Задержка анимации в мс
  isHighPriority?: boolean;
}

export const AnimatedPackCard: FC<AnimatedPackCardProps> = ({
  pack,
  onClick,
  delay = 0,
  isHighPriority: _isHighPriority
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Запуск анимации появления с задержкой
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  // Симуляция загрузки изображения
  useEffect(() => {
    if (isVisible) {
      const loadTimer = setTimeout(() => {
        setIsLoaded(true);
        setImageLoaded(true);
      }, 200 + delay);

      return () => clearTimeout(loadTimer);
    }
  }, [isVisible, delay]);

  return (
    <div
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible 
          ? 'translateY(0) scale(1)' 
          : 'translateY(20px) scale(0.95)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'opacity, transform'
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '12px',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          transform: isLoaded ? 'scale(1)' : 'scale(0.98)',
          boxShadow: isLoaded 
            ? '0 4px 12px var(--tg-theme-shadow-color)'
            : '0 2px 4px var(--tg-theme-shadow-color)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 8px 24px var(--tg-theme-shadow-color)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px var(--tg-theme-shadow-color)';
        }}
      >
        {/* Skeleton пока изображение не загружено */}
        {!imageLoaded && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              zIndex: 1
            }}
          />
        )}

        {/* Основная карточка */}
        <div
          style={{
            opacity: imageLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          <PackCard
            pack={pack}
            onClick={onClick}
          />
        </div>

        {/* Индикатор загрузки */}
        {!isLoaded && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '50%',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--tg-theme-hint-color)',
                borderTop: '2px solid var(--tg-theme-button-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
