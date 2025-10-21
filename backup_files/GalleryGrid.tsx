import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PackCard } from './PackCard';
import { useGalleryStore, getSessionSeed, setSessionSeed } from '../store/useGalleryStore';
import { useZoneLoading } from '../hooks/useZoneLoading';
import { seededShuffle } from '../utils/galleryUtils';

interface Pack {
  id: string;
  title: string;
  posters: Array<{ fileId: string; url: string }>;
}

interface GalleryGridProps {
  packs: Pack[];
  onPackClick?: (packId: string) => void;
}

export const GalleryGrid: React.FC<GalleryGridProps> = ({ 
  packs, 
  onPackClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const prevPackIdsRef = useRef<string>('');
  
  const {
    seed,
    shuffledPackIds,
    scrollY,
    setSeed,
    setShuffledPackIds,
    setScrollY
  } = useGalleryStore();

  // Зональное управление загрузкой
  const { observeElement, unobserveElement, cleanup, getZoneStats } = useZoneLoading({
    containerRef,
    onZoneChange: (zone) => {
      console.log(`🎯 Zone changed to: ${zone}`);
    },
    onPriorityChange: (packId, priority) => {
      console.log(`⚡ Priority updated for pack ${packId}: ${priority}`);
    }
  });

  // Инициализация при первом запуске
  useEffect(() => {
    if (isInitialized || packs.length === 0) return;

    // Получить или создать seed
    let currentSeed = seed;
    if (!currentSeed) {
      const sessionSeed = getSessionSeed();
      if (sessionSeed) {
        currentSeed = sessionSeed;
        setSeed(currentSeed);
      } else {
        currentSeed = Math.random().toString(36).substring(2);
        setSeed(currentSeed);
        setSessionSeed(currentSeed);
      }
    }

    // Перемешать packs если еще не сделано
    if (shuffledPackIds.length === 0) {
      const packIds = packs.map(p => p.id);
      const shuffled = seededShuffle(currentSeed, packIds);
      setShuffledPackIds(shuffled);
    }

    setIsInitialized(true);
  }, [packs, seed, shuffledPackIds.length, setSeed, setShuffledPackIds, isInitialized]);

  // Сброс при изменении packs (новые данные)
  useEffect(() => {
    if (packs.length > 0) {
      // Проверяем, действительно ли изменились данные
      const currentPackIds = packs.map(p => p.id).sort().join(',');
      
      // Сбрасываем только если данные действительно изменились
      if (currentPackIds !== prevPackIdsRef.current) {
        // Обновляем ссылку на предыдущие ID
        prevPackIdsRef.current = currentPackIds;
        
        // Создаем новый seed для новых данных
        const newSeed = Math.random().toString(36).substring(2);
        setSeed(newSeed);
        setSessionSeed(newSeed);
        
        // Перемешиваем заново
        const packIds = packs.map(p => p.id);
        const shuffled = seededShuffle(newSeed, packIds);
        setShuffledPackIds(shuffled);
      }
    }
  }, [packs, setSeed, setShuffledPackIds]);

  // Восстановление позиции скролла
  useEffect(() => {
    if (isInitialized && containerRef.current && scrollY > 0) {
      // Небольшая задержка для корректного восстановления
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = scrollY;
        }
      }, 100);
    }
  }, [isInitialized, scrollY]);

  // Сохранение позиции скролла при размонтировании
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (containerRef.current) {
        setScrollY(containerRef.current.scrollTop);
      }
    };

    const handleScroll = () => {
      if (containerRef.current) {
        setScrollY(containerRef.current.scrollTop);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      cleanup(); // Очистка зонального управления
    };
  }, [setScrollY, cleanup]);

  // Обработчик клика на пак
  const handlePackClick = useCallback((packId: string) => {
    // Сохранить текущую позицию скролла
    if (containerRef.current) {
      setScrollY(containerRef.current.scrollTop);
    }
    
    if (onPackClick) {
      onPackClick(packId);
    }
  }, [onPackClick, setScrollY]);

  if (!isInitialized || shuffledPackIds.length === 0) {
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

  // Получить отсортированные packs
  const sortedPacks = shuffledPackIds
    .map(id => packs.find(p => p.id === id))
    .filter(Boolean) as Pack[];

  // Разделить packs на пары для 2-колоночной сетки
  const packPairs = [];
  for (let i = 0; i < sortedPacks.length; i += 2) {
    packPairs.push([
      sortedPacks[i],
      sortedPacks[i + 1]
    ]);
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%'
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        padding: '8px'
      }}>
        {packPairs.map((pair, rowIndex) => {
          // Определяем приоритет загрузки для первых 6 паков (3 ряда)
          const isHighPriority = rowIndex < 3;
          
          return (
            <React.Fragment key={rowIndex}>
              <div
                ref={(el) => {
                  if (el && pair[0]) {
                    observeElement(el, pair[0].id);
                  }
                }}
                style={{ width: '100%' }}
              >
                <PackCard
                  pack={pair[0]}
                  isFirstRow={rowIndex === 0}
                  isHighPriority={isHighPriority}
                  onClick={handlePackClick}
                />
              </div>
              {pair[1] && (
                <div
                  ref={(el) => {
                    if (el && pair[1]) {
                      observeElement(el, pair[1].id);
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <PackCard
                    pack={pair[1]}
                    isFirstRow={rowIndex === 0}
                    isHighPriority={isHighPriority}
                    onClick={handlePackClick}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
