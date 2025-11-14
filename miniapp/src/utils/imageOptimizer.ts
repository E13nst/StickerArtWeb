/**
 * Image Optimization Utils
 * Поддержка WebP, srcset, responsive images
 */

import React from 'react';

export interface ImageOptions {
  width?: number;
  quality?: number;
  format?: 'webp' | 'original';
}

/**
 * Генерирует оптимизированный URL для изображения
 * @param url Оригинальный URL изображения
 * @param options Опции оптимизации
 */
export function getOptimizedImageUrl(url: string, options: ImageOptions = {}): string {
  const { width, quality = 85, format = 'original' } = options;
  
  // Если это внешний URL или уже оптимизирован - возвращаем как есть
  if (!url || url.startsWith('data:') || url.includes('?')) {
    return url;
  }
  
  const params = new URLSearchParams();
  
  if (width) {
    params.append('w', width.toString());
  }
  
  if (quality !== 85) {
    params.append('q', quality.toString());
  }
  
  if (format === 'webp') {
    params.append('fm', 'webp');
  }
  
  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Генерирует srcset для responsive images
 * @param url Базовый URL изображения
 * @param widths Массив ширин для генерации srcset
 */
export function generateSrcSet(url: string, widths: number[] = [128, 256, 512]): string {
  return widths
    .map(width => `${getOptimizedImageUrl(url, { width })} ${width}w`)
    .join(', ');
}

/**
 * Проверяет поддержку WebP браузером
 */
let webpSupport: boolean | null = null;

export async function checkWebPSupport(): Promise<boolean> {
  if (webpSupport !== null) {
    return webpSupport;
  }
  
  // Быстрая проверка через canvas
  if (typeof document === 'undefined') {
    return false;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupport = img.width > 0 && img.height > 0;
      resolve(webpSupport);
    };
    img.onerror = () => {
      webpSupport = false;
      resolve(false);
    };
    // Tiny WebP image (1x1 pixel)
    img.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
  });
}

/**
 * React Hook для использования оптимизированных изображений
 */
export function useOptimizedImage(url: string, options: ImageOptions = {}) {
  const [supportsWebP, setSupportsWebP] = React.useState(false);
  
  React.useEffect(() => {
    checkWebPSupport().then(setSupportsWebP);
  }, []);
  
  const format = supportsWebP && options.format !== 'original' ? 'webp' : 'original';
  const optimizedUrl = getOptimizedImageUrl(url, { ...options, format });
  
  return {
    src: optimizedUrl,
    srcSet: generateSrcSet(url, [128, 256, 512]),
    supportsWebP
  };
}

/**
 * Компонент OptimizedImage с автоматической поддержкой WebP
 */
interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  width?: number;
  quality?: number;
  sizes?: string;
  loading?: 'lazy' | 'eager';
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  fallbackSrc,
  width,
  quality = 85,
  sizes = '100vw',
  loading = 'lazy',
  alt = '',
  ...props
}) => {
  const [error, setError] = React.useState(false);
  const [supportsWebP, setSupportsWebP] = React.useState(false);
  
  React.useEffect(() => {
    checkWebPSupport().then(setSupportsWebP);
  }, []);
  
  const handleError = () => {
    setError(true);
  };
  
  // Если произошла ошибка и есть fallback - используем его
  const imageSrc = error && fallbackSrc ? fallbackSrc : src;
  
  // Генерируем WebP URL только если браузер поддерживает
  const format = supportsWebP ? 'webp' : 'original';
  const optimizedSrc = getOptimizedImageUrl(imageSrc, { width, quality, format });
  const srcSet = generateSrcSet(imageSrc, [128, 256, 512]);
  
  return (
    <img
      src={optimizedSrc}
      srcSet={srcSet}
      sizes={sizes}
      loading={loading}
      alt={alt}
      onError={handleError}
      {...props}
    />
  );
};

