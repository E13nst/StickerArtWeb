import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PackCard } from './PackCard';

interface Pack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    emoji: string;
  }>;
}

interface GalleryGridProps {
  packs: Pack[];
  onPackClick?: (packId: string) => void;
}

// Простой Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const GalleryGrid: React.FC<GalleryGridProps> = ({ 
  packs, 
  onPackClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shuffledPacks, setShuffledPacks] = useState<Pack[]>([]);

  // Простое перемешивание паков при изменении данных
  useEffect(() => {
    if (packs.length > 0) {
      const shuffled = shuffleArray(packs);
      setShuffledPacks(shuffled);
    }
  }, [packs]);

  // Мемоизированный обработчик клика на пак
  const handlePackClick = useCallback((packId: string) => {
    if (onPackClick) {
      onPackClick(packId);
    }
  }, [onPackClick]);

  if (shuffledPacks.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--tg-theme-hint-color)',
        padding: '40px 0'
      }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      data-testid="gallery-grid"
      style={{ 
        width: '100%'
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '8px',
        padding: '8px'
      }}>
        {shuffledPacks.map((pack, index) => {
          // Определяем приоритет загрузки для первых 6 паков
          const isHighPriority = index < 6;
          
          return (
            <div
              key={pack.id}
              style={{ width: '100%' }}
            >
              <PackCard
                pack={pack}
                isFirstRow={index < 2}
                isHighPriority={isHighPriority}
                onClick={handlePackClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
