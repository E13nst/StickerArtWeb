/**
 * API Request Deduplication
 * Предотвращает дублирующиеся запросы к одному и тому же endpoint
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private cache = new Map<string, { data: any; timestamp: number }>();
  
  // Настройки
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 минут
  private readonly REQUEST_TIMEOUT = 30 * 1000; // 30 секунд
  
  /**
   * Создаёт ключ для запроса
   */
  private createKey(url: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${url}${paramString}`;
  }
  
  /**
   * Проверяет валидность кэша
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_TTL;
  }
  
  /**
   * Очищает устаревшие pending requests
   */
  private cleanupStalePending(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        this.pendingRequests.delete(key);
      }
    }
  }
  
  /**
   * Выполняет запрос с дедупликацией
   */
  async fetch<T>(
    url: string,
    fetchFn: () => Promise<T>,
    params?: Record<string, any>,
    options: { skipCache?: boolean; ttl?: number } = {}
  ): Promise<T> {
    const key = this.createKey(url, params);
    
    // Проверяем кэш (если не skipCache)
    if (!options.skipCache) {
      const cached = this.cache.get(key);
      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log('[RequestDeduplicator] Cache hit:', key);
        return cached.data as T;
      }
    }
    
    // Проверяем есть ли уже pending request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      console.log('[RequestDeduplicator] Reusing pending request:', key);
      return pending.promise as Promise<T>;
    }
    
    // Создаём новый запрос
    console.log('[RequestDeduplicator] Creating new request:', key);
    const promise = fetchFn()
      .then((data) => {
        // Сохраняем в кэш
        this.cache.set(key, {
          data,
          timestamp: Date.now()
        });
        
        // Удаляем из pending
        this.pendingRequests.delete(key);
        
        return data;
      })
      .catch((error) => {
        // При ошибке тоже удаляем из pending
        this.pendingRequests.delete(key);
        throw error;
      });
    
    // Добавляем в pending
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });
    
    // Периодическая очистка
    this.cleanupStalePending();
    
    return promise;
  }
  
  /**
   * Инвалидирует кэш по ключу или паттерну
   */
  invalidate(urlPattern: string | RegExp): void {
    if (typeof urlPattern === 'string') {
      // Точное совпадение
      for (const key of this.cache.keys()) {
        if (key.startsWith(urlPattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Regex паттерн
      for (const key of this.cache.keys()) {
        if (urlPattern.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  }
  
  /**
   * Очищает весь кэш
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Получает статистику
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * React Hook для использования дедуплицированных запросов
 */
import { useCallback, useRef } from 'react';

export function useDedupedRequest<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
): () => Promise<T> {
  const abortControllerRef = useRef<AbortController | null>(null);
  
  return useCallback(() => {
    // Отменяем предыдущий запрос если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    return fetchFn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

