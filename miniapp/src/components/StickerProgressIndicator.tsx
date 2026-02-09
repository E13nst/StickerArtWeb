import { CSSProperties, FC } from 'react';

interface StickerProgressIndicatorProps {
  currentIndex: number;
  totalCount: number;
  className?: string;
  style?: CSSProperties;
}

export const StickerProgressIndicator: FC<StickerProgressIndicatorProps> = ({
  currentIndex,
  totalCount,
  className,
  style
}) => {
  if (totalCount <= 1) return null;

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '4px',
        zIndex: 3,
        ...style
      }}
    >
      {Array.from({ length: totalCount }, (_, index) => (
        <div
          key={index}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: index === currentIndex 
              ? 'rgba(255, 255, 255, 0.9)' 
              : 'rgba(255, 255, 255, 0.3)',
            transition: 'background-color 0.3s ease',
            cursor: 'pointer'
          }}
          title={`Стикер ${index + 1} из ${totalCount}`}
        />
      ))}
    </div>
  );
};



