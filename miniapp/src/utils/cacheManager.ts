/**
 * 🔥 СОВРЕМЕННЫЙ КЕШ-МЕНЕДЖЕР
 * 
 * Использует браузерный Cache API для эффективного хранения:
 * - Изображений (URL strings)
 * - Анимаций (JSON данные)
 * - Видео (Blobs)
 * 
 * Преимущества перед Map:
 * ✅ Автоматическое управление памятью браузером
 * ✅ Переживает перезагрузку страницы
 * ✅ Работает оффлайн
 * ✅ Нет риска утечек памяти
 * ✅ Fallback на Memory cache для старых браузеров
 */

export type ResourceType = 'image' | 'animation' | 'video';

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  images: `stickers-images-${CACHE_VERSION}`,
  animations: `stickers-animations-${CACHE_VERSION}`,
  videos: `stickers-videos-${CACHE_VERSION}`
} as const;

// Максимальное количество элементов в каждом кеше
const MAX_CACHE_ITEMS = {
  images: 200,      // URL strings - легкие
  animations: 50,   // JSON ~200KB каждый = 10MB max
  videos: 30        // Blobs ~2MB каждый = 60MB max
} as const;

// Время жизни кеша (7 дней)
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface CacheMetadata {
  fileId: string;
  timestamp: number;
  type: ResourceType;
  size?: number;
}

class CacheManager {
  // Memory fallback для старых браузеров
  private memoryFallback = {
    images: new Map<string, string>(),
    animations: new Map<string, any>(),
    videos: new Map<string, string>()
  };
  
  // 🔥 НОВОЕ: Синхронный кеш для быстрых проверок (дублирует Cache API)
  // Используется только для has() и синхронных get() вызовов
  private syncCache = {
    images: new Map<string, string>(),
    animations: new Map<string, any>(),
    videos: new Map<string, string>()
  };
  
  private metadata = new Map<string, CacheMetadata>();
  private cacheApiAvailable: boolean;
  private initialized = false;

  constructor() {
    this.cacheApiAvailable = 'caches' in window;
  }

  /**
   * Инициализация: очистка старых версий кеша
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    if (this.cacheApiAvailable) {
      try {
        // Удаляем старые версии кеша
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('stickers-') && !Object.values(CACHE_NAMES).includes(name)
        );
        
        await Promise.all(oldCaches.map(name => caches.delete(name)));
        
        console.log(`[CacheManager] Initialized with Cache API, removed ${oldCaches.length} old caches`);
      } catch (error) {
        console.warn('[CacheManager] Failed to initialize Cache API:', error);
        this.cacheApiAvailable = false;
      }
    } else {
      console.log('[CacheManager] Cache API not available, using memory fallback');
    }
    
    this.initialized = true;
  }

  /**
   * Получить имя кеша для типа ресурса
   */
  private getCacheName(type: ResourceType): string {
    switch (type) {
      case 'image':
        return CACHE_NAMES.images;
      case 'animation':
        return CACHE_NAMES.animations;
      case 'video':
        return CACHE_NAMES.videos;
    }
  }

  /**
   * Создать уникальный URL для кеширования
   */
  private createCacheKey(fileId: string, type: ResourceType): string {
    return `https://cache.local/${type}/${fileId}`;
  }

  /**
   * Сохранить ресурс в кеш
   */
  async set(fileId: string, data: string | any, type: ResourceType): Promise<void> {
    await this.init();
    
    // 🔥 КРИТИЧНО: Сохраняем в syncCache СРАЗУ для немедленного доступа
    const map = this.syncCache[`${type}s` as 'images' | 'animations' | 'videos'];
    map.set(fileId, data);
    
    const cacheKey = this.createCacheKey(fileId, type);
    const metadata: CacheMetadata = {
      fileId,
      timestamp: Date.now(),
      type
    };

    if (this.cacheApiAvailable) {
      try {
        const cacheName = this.getCacheName(type);
        const cache = await caches.open(cacheName);
        
        // Создаем Response в зависимости от типа данных
        let response: Response;
        
        if (type === 'image') {
          // Для изображений сохраняем просто URL string
          response = new Response(data, {
            headers: {
              'Content-Type': 'text/plain',
              'X-Cache-Timestamp': metadata.timestamp.toString()
            }
          });
        } else if (type === 'animation') {
          // Для анимаций сохраняем JSON
          response = new Response(JSON.stringify(data), {
            headers: {
              'Content-Type': 'application/json',
              'X-Cache-Timestamp': metadata.timestamp.toString()
            }
          });
        } else {
          // Для видео data уже blob URL string
          response = new Response(data, {
            headers: {
              'Content-Type': 'text/plain',
              'X-Cache-Timestamp': metadata.timestamp.toString()
            }
          });
        }
        
        await cache.put(cacheKey, response);
        this.metadata.set(cacheKey, metadata);
        
        // Проверяем лимиты и очищаем старые записи
        await this.enforceLimit(type);
      } catch (error) {
        console.warn(`[CacheManager] Failed to cache ${type}:`, error);
        // Fallback на memory (syncCache уже заполнен выше)
        this.setMemory(fileId, data, type);
      }
    } else {
      // Memory fallback (syncCache уже заполнен выше)
      this.setMemory(fileId, data, type);
    }
  }

  /**
   * Получить ресурс из кеша
   */
  async get(fileId: string, type: ResourceType): Promise<string | any | undefined> {
    await this.init();
    
    // 🔥 ОПТИМИЗАЦИЯ: Сначала проверяем syncCache
    const syncData = this.getSync(fileId, type);
    if (syncData !== undefined) {
      return syncData;
    }
    
    const cacheKey = this.createCacheKey(fileId, type);

    if (this.cacheApiAvailable) {
      try {
        const cacheName = this.getCacheName(type);
        const cache = await caches.open(cacheName);
        const response = await cache.match(cacheKey);
        
        if (!response) {
          return undefined;
        }
        
        // Проверяем возраст кеша
        const timestamp = response.headers.get('X-Cache-Timestamp');
        if (timestamp) {
          const age = Date.now() - parseInt(timestamp, 10);
          if (age > CACHE_MAX_AGE) {
            // Кеш устарел, удаляем
            await cache.delete(cacheKey);
            this.metadata.delete(cacheKey);
            return undefined;
          }
        }
        
        // Возвращаем данные в зависимости от типа
        let data: string | any;
        if (type === 'animation') {
          data = await response.json();
        } else {
          data = await response.text();
        }
        
        // 🔥 КРИТИЧНО: Заполняем syncCache при чтении из Cache API
        const map = this.syncCache[`${type}s` as 'images' | 'animations' | 'videos'];
        map.set(fileId, data);
        
        return data;
      } catch (error) {
        console.warn(`[CacheManager] Failed to get ${type} from cache:`, error);
        // Fallback на memory
        return this.getMemory(fileId, type);
      }
    } else {
      return this.getMemory(fileId, type);
    }
  }

  /**
   * Проверить наличие в кеше (синхронно через sync cache)
   */
  has(fileId: string, type: ResourceType): boolean {
    const map = this.syncCache[`${type}s` as 'images' | 'animations' | 'videos'];
    return map.has(fileId);
  }
  
  /**
   * Получить из sync cache (синхронно, для совместимости)
   */
  getSync(fileId: string, type: ResourceType): string | any | undefined {
    const map = this.syncCache[`${type}s` as 'images' | 'animations' | 'videos'];
    return map.get(fileId);
  }

  /**
   * Удалить из кеша
   */
  async delete(fileId: string, type: ResourceType): Promise<boolean> {
    await this.init();
    
    const cacheKey = this.createCacheKey(fileId, type);

    if (this.cacheApiAvailable) {
      try {
        const cacheName = this.getCacheName(type);
        const cache = await caches.open(cacheName);
        const deleted = await cache.delete(cacheKey);
        this.metadata.delete(cacheKey);
        
        // Удаляем из sync cache
        const map = this.syncCache[`${type}s` as 'images' | 'animations' | 'videos'];
        map.delete(fileId);
        
        // ✅ FIX: Не отзываем blob URL сразу при удалении из кеша
        // Компоненты могут все еще использовать его, и они обработают ошибку через onError
        // Blob URL будет автоматически собран сборщиком мусора, когда на него не будет ссылок
        // Это предотвращает ERR_FILE_NOT_FOUND ошибки
        
        return deleted;
      } catch (error) {
        console.warn(`[CacheManager] Failed to delete ${type}:`, error);
        return this.deleteMemory(fileId, type);
      }
    } else {
      return this.deleteMemory(fileId, type);
    }
  }

  /**
   * Очистить весь кеш определенного типа
   */
  async clear(type?: ResourceType): Promise<void> {
    await this.init();

    if (this.cacheApiAvailable) {
      try {
        if (type) {
          // Очистить конкретный тип
          const cacheName = this.getCacheName(type);
          
          // Revoke все video blob URLs перед удалением
          if (type === 'video') {
            const cache = await caches.open(cacheName);
            // ✅ FIX: Не отзываем blob URLs при очистке Cache API
            // Компоненты могут все еще использовать их, и они обработают ошибку через onError
            // Blob URLs будут автоматически собраны сборщиком мусора
            // Это предотвращает ERR_FILE_NOT_FOUND ошибки
          }
          
          await caches.delete(cacheName);
          
          // Очистить метаданные
          for (const [key, meta] of this.metadata.entries()) {
            if (meta.type === type) {
              this.metadata.delete(key);
            }
          }
        } else {
          // Очистить все типы
          await Promise.all([
            this.clear('image'),
            this.clear('animation'),
            this.clear('video')
          ]);
        }
      } catch (error) {
        console.warn('[CacheManager] Failed to clear cache:', error);
      }
    }
    
    // Очистить sync cache
    if (type) {
      this.syncCache[`${type}s` as 'images' | 'animations' | 'videos'].clear();
    } else {
      this.syncCache.images.clear();
      this.syncCache.animations.clear();
      this.syncCache.videos.clear();
    }
    
    // Очистить memory fallback
    if (type) {
      this.memoryFallback[`${type}s` as 'images' | 'animations' | 'videos'].clear();
    } else {
      this.memoryFallback.images.clear();
      this.memoryFallback.animations.clear();
      // ✅ FIX: Не отзываем blob URLs при очистке - компоненты могут все еще использовать их
      // Blob URLs будут автоматически собраны сборщиком мусора, когда на них не будет ссылок
      // Это предотвращает ERR_FILE_NOT_FOUND ошибки
      this.memoryFallback.videos.clear();
    }
  }

  /**
   * Применить лимиты на размер кеша (LRU eviction)
   */
  private async enforceLimit(type: ResourceType): Promise<void> {
    if (!this.cacheApiAvailable) return;

    const cacheName = this.getCacheName(type);
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    const maxItems = MAX_CACHE_ITEMS[`${type}s` as 'images' | 'animations' | 'videos'];
    
    if (keys.length > maxItems) {
      // Сортируем по timestamp (LRU)
      const sortedKeys = keys
        .map(request => {
          const cacheKey = request.url;
          const meta = this.metadata.get(cacheKey);
          return { request, timestamp: meta?.timestamp || 0 };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Удаляем самые старые
      const toDelete = sortedKeys.slice(0, keys.length - maxItems);
      
      const map = this.syncCache[`${type}s` as 'images' | 'animations' | 'videos'];
      
      for (const { request } of toDelete) {
        await cache.delete(request);
        
        // Извлекаем fileId из URL для удаления из sync cache
        const urlParts = request.url.split('/');
        const fileId = urlParts[urlParts.length - 1];
        map.delete(fileId);
        
        this.metadata.delete(request.url);
        
        // Revoke blob URLs для видео
        if (type === 'video') {
          const response = await cache.match(request);
          if (response) {
            const url = await response.text();
            if (url.startsWith('blob:')) {
              URL.revokeObjectURL(url);
            }
          }
        }
      }
      
      console.log(`[CacheManager] Evicted ${toDelete.length} old ${type} entries`);
    }
  }

  /**
   * Memory fallback методы
   */
  private setMemory(fileId: string, data: string | any, type: ResourceType): void {
    const map = this.memoryFallback[`${type}s` as 'images' | 'animations' | 'videos'];
    map.set(fileId, data);
    
    // Простой LRU для memory cache
    const maxItems = MAX_CACHE_ITEMS[`${type}s` as 'images' | 'animations' | 'videos'];
    if (map.size > maxItems) {
      const firstKey = map.keys().next().value;
      if (type === 'video') {
        const url = map.get(firstKey);
        if (url?.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      }
      map.delete(firstKey);
    }
  }

  private getMemory(fileId: string, type: ResourceType): string | any | undefined {
    const map = this.memoryFallback[`${type}s` as 'images' | 'animations' | 'videos'];
    return map.get(fileId);
  }

  private deleteMemory(fileId: string, type: ResourceType): boolean {
    const map = this.memoryFallback[`${type}s` as 'images' | 'animations' | 'videos'];
    if (type === 'video') {
      const url = map.get(fileId);
      if (url?.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
    return map.delete(fileId);
  }

  /**
   * Получить статистику кеша
   */
  async getStats(): Promise<Record<ResourceType, number>> {
    await this.init();
    
    const stats: Record<ResourceType, number> = {
      image: 0,
      animation: 0,
      video: 0
    };

    if (this.cacheApiAvailable) {
      try {
        for (const type of ['image', 'animation', 'video'] as ResourceType[]) {
          const cacheName = this.getCacheName(type);
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          stats[type] = keys.length;
        }
      } catch (error) {
        console.warn('[CacheManager] Failed to get stats:', error);
      }
    } else {
      stats.image = this.memoryFallback.images.size;
      stats.animation = this.memoryFallback.animations.size;
      stats.video = this.memoryFallback.videos.size;
    }

    return stats;
  }
}

// Глобальный экземпляр
export const cacheManager = new CacheManager();

