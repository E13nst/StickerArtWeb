import React, { useState, useRef, useEffect, memo } from 'react';
import { Box, Typography } from '@mui/material';

interface LazyImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
}

const LazyImageComponent: React.FC<LazyImageProps> = ({
  src,
  alt,
  style,
  onLoad,
  onError,
  placeholder,
  fallback
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        rootMargin: '50px' // Загружаем изображения за 50px до появления в viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      {/* Placeholder пока изображение не загружено */}
      {!isLoaded && !hasError && (
        <Box>
          {placeholder || (
            <Typography
              sx={{
                fontSize: '1.5rem',
                color: 'text.secondary'
              }}
            >
              🎨
            </Typography>
          )}
        </Box>
      )}

      {/* Изображение загружается только когда попадает в viewport */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          style={{
            ...style,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: isLoaded ? 'block' : 'none'
          }}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}

      {/* Fallback при ошибке загрузки */}
      {hasError && (
        <Box>
          {fallback || (
            <Typography
              sx={{
                fontSize: '1.5rem',
                color: 'text.secondary'
              }}
            >
              ❌
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

// Мемоизируем компонент для предотвращения лишних ре-рендеров
export const LazyImage = memo(LazyImageComponent);
