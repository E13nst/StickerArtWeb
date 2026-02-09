import { FC } from 'react';

interface SkeletonCardProps {
  count?: number;
  className?: string;
}

export const SkeletonCard: FC<SkeletonCardProps> = ({ 
  count = 1,
  className = ""
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`skeleton-card ${className}`}
          style={{
            height: '200px',
            width: '100%',
            borderRadius: '12px',
            background: `linear-gradient(90deg, var(--tg-theme-secondary-bg-color, #f0f0f0) 25%, var(--tg-theme-bg-color, #ffffff) 50%, var(--tg-theme-secondary-bg-color, #f0f0f0) 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Имитация контента карточки */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60px',
            height: '60px',
            backgroundColor: 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }} />
          
          {/* Имитация заголовка */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '8px',
            right: '8px',
            height: '16px',
            backgroundColor: 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
            borderRadius: '8px',
            animation: 'pulse 2s infinite'
          }} />
        </div>
      ))}
    </>
  );
};

// CSS анимации (добавить в index.css)
const skeletonStyles = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.skeleton-card {
  transition: opacity 0.3s ease-out;
}
`;

// Добавляем стили в head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = skeletonStyles;
  document.head.appendChild(style);
}
