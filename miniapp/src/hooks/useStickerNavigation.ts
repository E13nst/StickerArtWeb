import { useState, useCallback, useRef } from 'react';

interface UseStickerNavigationOptions {
  stickerCount: number;
  isModal?: boolean;
}

export const useStickerNavigation = ({ 
  stickerCount, 
  isModal = false 
}: UseStickerNavigationOptions) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentStickerLoading, setCurrentStickerLoading] = useState(false);
  const [isMainLoaded, setIsMainLoaded] = useState(false);
  
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const touchHandledRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const goToNextSticker = useCallback(() => {
    if (stickerCount <= 1) return;
    setActiveIndex((prev) => (prev + 1) % stickerCount);
  }, [stickerCount]);

  const goToPrevSticker = useCallback(() => {
    if (stickerCount <= 1) return;
    setActiveIndex((prev) => (prev - 1 + stickerCount) % stickerCount);
  }, [stickerCount]);

  const handleStickerClick = useCallback((index: number) => {
    setActiveIndex(index);
    if (scrollerRef.current) {
      const node = scrollerRef.current.querySelector(`[data-thumbnail-index="${index}"]`);
      if (node) {
        (node as HTMLElement).scrollIntoView({ 
          behavior: 'smooth', 
          inline: 'center', 
          block: 'nearest' 
        });
      }
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (stickerCount <= 1) return;
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchCurrentXRef.current = touch.clientX;
  }, [stickerCount]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    touchCurrentXRef.current = event.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (stickerCount <= 1) return;
    const start = touchStartXRef.current;
    const end = touchCurrentXRef.current ?? start;
    let handled = false;

    if (start !== null && end !== null) {
      const delta = end - start;
      if (Math.abs(delta) > 40) {
        if (delta > 0) {
          goToPrevSticker();
        } else {
          goToNextSticker();
        }
        handled = true;
      }
    }

    touchStartXRef.current = null;
    touchCurrentXRef.current = null;

    if (handled) {
      touchHandledRef.current = true;
      window.setTimeout(() => {
        touchHandledRef.current = false;
      }, 0);
    } else {
      touchHandledRef.current = false;
    }
  }, [goToNextSticker, goToPrevSticker, stickerCount]);

  const handleTouchCancel = useCallback(() => {
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
  }, []);

  return {
    activeIndex,
    setActiveIndex,
    currentStickerLoading,
    setCurrentStickerLoading,
    isMainLoaded,
    setIsMainLoaded,
    goToNextSticker,
    goToPrevSticker,
    handleStickerClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    touchHandledRef,
    scrollerRef,
    previewRef
  };
};

