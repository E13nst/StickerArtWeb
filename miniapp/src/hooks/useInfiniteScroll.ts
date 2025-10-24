import { useState, useEffect, useRef } from 'react';

interface UseInfiniteScrollProps {
  hasNextPage: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
  rootMargin?: string;
}

export const useInfiniteScroll = ({
  hasNextPage,
  isLoading,
  onLoadMore,
  threshold = 100,
  rootMargin = '100px'
}: UseInfiniteScrollProps) => {
  const [isNearBottom, setIsNearBottom] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isLoading) {
          setIsNearBottom(true);
          onLoadMore();
        }
      },
      {
        rootMargin,
        threshold: 0.1
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isLoading, onLoadMore, rootMargin]);

  useEffect(() => {
    if (!isLoading) {
      setIsNearBottom(false);
    }
  }, [isLoading]);

  return {
    sentinelRef,
    isNearBottom
  };
};
