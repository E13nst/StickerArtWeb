import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PackCard } from './PackCard';
import { useScrollElement } from '../contexts/ScrollContext';

interface Pack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    isVideo: boolean;
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

export const GalleryGrid: React.FC<GalleryGridProps> = ({ packs, onPackClick }) => {
  const scrollElement = useScrollElement();
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const [shuffledPacks, setShuffledPacks] = useState<Pack[]>([]);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [activeColumn, setActiveColumn] = useState<'left' | 'right' | null>(null);
  const lastScrollY = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);
  
  const [floatAmplitudes] = useState(() => ({
    left: Math.floor(Math.random() * 9) + 8,
    right: Math.floor(Math.random() * 9) + 8
  }));

  useEffect(() => {
    if (packs.length > 0) setShuffledPacks(shuffleArray(packs));
  }, [packs]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = scrollElement 
        ? scrollElement.scrollTop 
        : (window.scrollY || document.documentElement.scrollTop);
      const delta = scrollY - lastScrollY.current;
      lastScrollY.current = scrollY;
      setScrollVelocity(delta);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => setScrollVelocity(0), 100);
    };

    const detectColumn = (x: number) => {
      if (!leftColumnRef.current || !rightColumnRef.current) return;
      const leftRect = leftColumnRef.current.getBoundingClientRect();
      const rightRect = rightColumnRef.current.getBoundingClientRect();
      if (x >= leftRect.left && x <= leftRect.right) setActiveColumn('left');
      else if (x >= rightRect.left && x <= rightRect.right) setActiveColumn('right');
    };

    const handleMouseMove = (e: MouseEvent) => detectColumn(e.clientX);
    const handleTouchMove = (e: TouchEvent) => e.touches[0] && detectColumn(e.touches[0].clientX);
    
    lastScrollY.current = scrollElement 
      ? scrollElement.scrollTop 
      : (window.scrollY || document.documentElement.scrollTop);
    
    const targetElement = scrollElement || window;
    targetElement.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    
    return () => {
      targetElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [scrollElement]);

  const getScrollBoost = useCallback((column: 'left' | 'right') => {
    if (!activeColumn || Math.abs(scrollVelocity) < 1) return 0;
    const boost = Math.min(Math.abs(scrollVelocity) * 0.5, 16);
    const isActive = activeColumn === column;
    return scrollVelocity > 0 ? (isActive ? -boost : boost * 0.3) : (isActive ? boost * 0.3 : -boost * 0.5);
  }, [scrollVelocity, activeColumn]);

  if (shuffledPacks.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tg-theme-hint-color)', padding: '40px 0' }}>Загрузка...</div>;
  }

  const leftColumnPacks = shuffledPacks.filter((_, i) => i % 2 === 0);
  const rightColumnPacks = shuffledPacks.filter((_, i) => i % 2 === 1);
  const columnStyle = { flex: '1 1 0%', display: 'flex', flexDirection: 'column' as const, gap: '6px', minWidth: 0 };

  return (
    <>
      <style>{`
        @keyframes floatColumn1 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-${floatAmplitudes.left}px); }
        }
        @keyframes floatColumn2 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(${floatAmplitudes.right}px); }
        }
        .gallery-column-float-1 {
          animation: floatColumn1 6.18s ease-in-out infinite;
        }
        .gallery-column-float-2 {
          animation: floatColumn2 7.64s ease-in-out infinite;
          animation-delay: 1.18s;
        }
      `}</style>
      <div data-testid="gallery-grid" style={{ width: '100%', display: 'flex', gap: '6px', padding: '6px' }}>
        <div ref={leftColumnRef} className="gallery-column-float-1" style={{ ...columnStyle, transform: `translateY(${getScrollBoost('left')}px)`, transition: 'transform 0.3s ease-out' }}>
          {leftColumnPacks.map((pack, i) => (
            <div key={pack.id} style={{ width: '100%' }}>
              <PackCard pack={pack} isFirstRow={i < 1} isHighPriority={i < 3} onClick={onPackClick} />
            </div>
          ))}
        </div>
        <div ref={rightColumnRef} className="gallery-column-float-2" style={{ ...columnStyle, transform: `translateY(${getScrollBoost('right')}px)`, transition: 'transform 0.3s ease-out' }}>
          {rightColumnPacks.map((pack, i) => (
            <div key={pack.id} style={{ width: '100%' }}>
              <PackCard pack={pack} isFirstRow={i < 1} isHighPriority={i < 3} onClick={onPackClick} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
