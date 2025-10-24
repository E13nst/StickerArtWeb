import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface SmartCacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live в миллисекундах
  preloadNext?: boolean;
}

export const useSmartCache = <T>(options: SmartCacheOptions = {}) => {
  const {
    maxSize = 100,
    ttl = 5 * 60 * 1000, // 5 минут
    preloadNext = true
  } = options;

  const cacheRef = useRef<Map<string, CacheItem<T>>>(new Map());
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    size: 0
  });

  // Очистка устаревших элементов
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    for (const [key, item] of cache.entries()) {
      if (now - item.timestamp > ttl) {
        cache.delete(key);
      }
    }
    
    setCacheStats(prev => ({ ...prev, size: cache.size }));
  }, [ttl]);

  // LRU очистка при превышении размера
  const evictLRU = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size <= maxSize) return;

    // Сортируем по последнему доступу
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Удаляем самые старые
    const toRemove = entries.slice(0, cache.size - maxSize);
    toRemove.forEach(([key]) => cache.delete(key));
    
    setCacheStats(prev => ({ ...prev, size: cache.size }));
  }, [maxSize]);

  // Получение из кеша
  const get = useCallback((key: string): T | null => {
    const cache = cacheRef.current;
    const item = cache.get(key);
    
    if (!item) {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    // Проверяем TTL
    if (Date.now() - item.timestamp > ttl) {
      cache.delete(key);
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    // Обновляем статистику доступа
    item.accessCount++;
    item.lastAccessed = Date.now();
    
    setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
    return item.data;
  }, [ttl]);

  // Сохранение в кеш
  const set = useCallback((key: string, data: T) => {
    const cache = cacheRef.current;
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    });

    // Очистка при необходимости
    if (cache.size > maxSize) {
      evictLRU();
    }
    
    setCacheStats(prev => ({ ...prev, size: cache.size }));
  }, [maxSize, evictLRU]);

  // Предзагрузка следующей страницы
  const preloadNextPage = useCallback(async (
    currentPage: number,
    totalPages: number,
    fetchFunction: (page: number) => Promise<T>
  ) => {
    if (!preloadNext || currentPage >= totalPages - 1) return;

    const nextPageKey = `page_${currentPage + 1}`;
    
    // Проверяем, не загружена ли уже следующая страница
    if (cacheRef.current.has(nextPageKey)) return;

    try {
      console.log(`🔄 Предзагрузка страницы ${currentPage + 1}...`);
      const data = await fetchFunction(currentPage + 1);
      set(nextPageKey, data);
      console.log(`✅ Страница ${currentPage + 1} предзагружена`);
    } catch (error) {
      console.warn(`❌ Ошибка предзагрузки страницы ${currentPage + 1}:`, error);
    }
  }, [preloadNext, set]);

  // Предзагрузка изображений
  const preloadImages = useCallback(async (imageUrls: string[]) => {
    const preloadPromises = imageUrls.map(url => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Игнорируем ошибки
        img.src = url;
      });
    });

    await Promise.allSettled(preloadPromises);
  }, []);

  // Очистка кеша
  const clear = useCallback(() => {
    cacheRef.current.clear();
    setCacheStats({ hits: 0, misses: 0, size: 0 });
  }, []);

  // Получение статистики
  const getStats = useCallback(() => {
    const cache = cacheRef.current;
    const hitRate = cacheStats.hits + cacheStats.misses > 0 
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(1)
      : '0';
    
    return {
      ...cacheStats,
      hitRate: `${hitRate}%`,
      memoryUsage: cache.size
    };
  }, [cacheStats]);

  // Периодическая очистка
  useEffect(() => {
    const interval = setInterval(cleanupExpired, 60000); // Каждую минуту
    return () => clearInterval(interval);
  }, [cleanupExpired]);

  return {
    get,
    set,
    preloadNextPage,
    preloadImages,
    clear,
    getStats,
    cacheSize: cacheStats.size
  };
};
