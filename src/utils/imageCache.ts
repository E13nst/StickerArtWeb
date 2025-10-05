import React from 'react';
import { logger } from '@/utils/logger';

// Система кеширования изображений в памяти
class ImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();
  private maxSize = 100; // Максимум 100 изображений в кеше

  async loadImage(src: string): Promise<HTMLImageElement> {
    // Если изображение уже в кеше, возвращаем его
    if (this.cache.has(src)) {
      logger.log('📦 Изображение из кеша:', src);
      return this.cache.get(src)!;
    }

    // Если изображение уже загружается, ждем его
    if (this.loadingPromises.has(src)) {
      logger.log('⏳ Ждем загрузку изображения:', src);
      return this.loadingPromises.get(src)!;
    }

    // Создаем новый промис загрузки
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      
      // Настраиваем кеширование браузера
      img.crossOrigin = 'anonymous'; // Для CORS изображений
      
      img.onload = () => {
        logger.log('✅ Изображение загружено и кешировано:', src);
        
        // Добавляем в кеш
        this.addToCache(src, img);
        
        // Удаляем из промисов загрузки
        this.loadingPromises.delete(src);
        
        resolve(img);
      };
      
      img.onerror = (error) => {
        console.error('❌ Ошибка загрузки изображения:', src, error);
        
        // Удаляем из промисов загрузки
        this.loadingPromises.delete(src);
        
        reject(error);
      };
      
      // Устанавливаем src для начала загрузки
      // Браузер автоматически будет использовать кеш для повторных запросов
      img.src = src;
    });

    // Сохраняем промис загрузки
    this.loadingPromises.set(src, promise);
    
    return promise;
  }

  private addToCache(src: string, img: HTMLImageElement) {
    // Если кеш переполнен, удаляем старые изображения
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.log('🗑️ Удалено старое изображение из кеша:', firstKey);
    }
    
    this.cache.set(src, img);
  }

  // Предзагрузка изображений
  preloadImages(srcs: string[]): Promise<void[]> {
    return Promise.allSettled(
      srcs.map(src => this.loadImage(src))
    ).then(results => {
      const errors = results.filter(result => result.status === 'rejected');
      if (errors.length > 0) {
        logger.warn('⚠️ Некоторые изображения не удалось предзагрузить:', errors.length);
      }
      return [];
    });
  }

  // Очистка кеша
  clear() {
    this.cache.clear();
    this.loadingPromises.clear();
    logger.log('🧹 Кеш изображений очищен');
  }

  // Получить статистику кеша
  getStats() {
    return {
      cachedImages: this.cache.size,
      loadingImages: this.loadingPromises.size,
      maxSize: this.maxSize
    };
  }
}

// Создаем глобальный экземпляр кеша
export const imageCache = new ImageCache();

// Хук для использования кеша изображений
export function useImageCache(src: string) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!src) return;

    setLoading(true);
    setError(false);

    imageCache.loadImage(src)
      .then((img) => {
        setImage(img);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [src]);

  return { image, loading, error };
}
