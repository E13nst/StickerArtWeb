import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

  // Мемоизированный обработчик клика на пак
  const handlePackClick = useCallback((packId: string) => {
    // Сохранить текущую позицию скролла
    if (containerRef.current) {
      setScrollY(containerRef.current.scrollTop);
    }
    
    if (onPackClick) {
      onPackClick(packId);
    }
  }, [onPackClick, setScrollY]);

  // Мемоизированные ref колбэки для оптимизации производительности
  const createRefCallback = useCallback((packId: string) => {
    return (el: HTMLDivElement | null) => {
      if (el) {
        observeElement(el, packId);
      }
    };
  }, [observeElement]);

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
        {sortedPacks.map((pack, index) => {
          // Определяем приоритет загрузки для первых 6 паков
          const isHighPriority = index < 6;
          
          return (
            <div
              key={pack.id}
              ref={createRefCallback(pack.id)}
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
