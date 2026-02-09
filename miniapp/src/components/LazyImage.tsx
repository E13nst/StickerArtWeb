import { useState, useRef, useEffect, memo, ReactNode, CSSProperties, FC } from 'react';
import './LazyImage.css';

interface LazyImageProps {
  src: string;
  alt: string;
  style?: CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  placeholder?: ReactNode;
  fallback?: ReactNode;
}

const LazyImageComponent: FC<LazyImageProps> = ({
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
        rootMargin: '50px'
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
    <div ref={containerRef} className="lazy-image-container">
      {/* Placeholder пока изображение не загружено */}
      {!isLoaded && !hasError && (
        <div className="lazy-image-placeholder">
          {placeholder || <span className="lazy-image-emoji">🎨</span>}
        </div>
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
        <div className="lazy-image-fallback">
          {fallback || <span className="lazy-image-emoji">❌</span>}
        </div>
      )}
    </div>
  );
};

export const LazyImage = memo(LazyImageComponent);
