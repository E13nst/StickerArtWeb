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
    const requestId = Math.random().toString(36).substr(2, 9);
    
    console.log(`[RequestDeduplicator:${requestId}] Starting fetch:`, {
      url,
      params,
      skipCache: options.skipCache,
      key: key.substring(0, 100) + (key.length > 100 ? '...' : '')
    });
    
    // Проверяем кэш (если не skipCache)
    if (!options.skipCache) {
      const cached = this.cache.get(key);
      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log(`[RequestDeduplicator:${requestId}] ✅ Cache hit (age: ${Date.now() - cached.timestamp}ms)`);
        return cached.data as T;
      } else if (cached) {
        console.log(`[RequestDeduplicator:${requestId}] ⚠️ Cache expired (age: ${Date.now() - cached.timestamp}ms)`);
      }
    } else {
      console.log(`[RequestDeduplicator:${requestId}] ⏭️ Skipping cache`);
    }
    
    // Проверяем есть ли уже pending request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      const age = Date.now() - pending.timestamp;
      console.log(`[RequestDeduplicator:${requestId}] ♻️ Reusing pending request (age: ${age}ms)`);
      
      // Защита от зависших запросов
      if (age > this.REQUEST_TIMEOUT) {
        console.warn(`[RequestDeduplicator:${requestId}] ⚠️ Pending request timeout! Removing stale request.`);
        this.pendingRequests.delete(key);
      } else {
        return pending.promise as Promise<T>;
      }
    }
    
    // Создаём новый запрос
    console.log(`[RequestDeduplicator:${requestId}] 🚀 Creating new request`);
    const startTime = Date.now();
    
    const promise = fetchFn()
      .then((data) => {
        const duration = Date.now() - startTime;
        console.log(`[RequestDeduplicator:${requestId}] ✅ Request completed (${duration}ms)`);
        
        // Сохраняем в кэш
        if (!options.skipCache) {
          this.cache.set(key, {
            data,
            timestamp: Date.now()
          });
        }
        
        // Удаляем из pending
        this.pendingRequests.delete(key);
        
        return data;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        console.error(`[RequestDeduplicator:${requestId}] ❌ Request failed (${duration}ms):`, error);
        
        // При ошибке тоже удаляем из pending
        this.pendingRequests.delete(key);
        throw error;
      });
    
    // Добавляем в pending
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });
    
    console.log(`[RequestDeduplicator:${requestId}] ⏳ Added to pending (total: ${this.pendingRequests.size})`);
    
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

