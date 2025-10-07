import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';

interface LazyImageProps {
  src: string;
  alt: string;
  onLoad?: () => void;
  onError?: () => void;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  onLoad,
  onError,
  placeholder,
  fallback,
  style,
  className
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer для ленивой загрузки
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Загружаем за 50px до появления в viewport
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Загружаем изображение только когда оно в viewport
  useEffect(() => {
    if (isInView && !isLoaded && !hasError) {
      const img = new Image();
      img.onload = handleLoad;
      img.onerror = handleError;
      img.src = src;
    }
  }, [isInView, isLoaded, hasError, src, handleLoad, handleError]);

  return (
    <Box
      ref={containerRef}
      className={className}
      style={style}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Плейсхолдер пока изображение не загружено */}
      {!isLoaded && !hasError && placeholder}

      {/* Изображение */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Fallback при ошибке */}
      {hasError && fallback}
    </Box>
  );
};