import { imageCache } from './galleryUtils';

// Приоритеты загрузки
export enum LoadPriority {
  TIER_0_MODAL = 5,            // Стикеры в модальном окне (наивысший)
  TIER_1_FIRST_6_PACKS = 4,    // Первые 6 паков на экране
  TIER_2_FIRST_IMAGE = 3,      // Первое изображение каждого пака
  TIER_3_ADDITIONAL = 2,       // Остальные изображения
  TIER_4_BACKGROUND = 1       // Фоновые паки
}

// Бэкенд-оригин (для нормализации абсолютных URL в относительные прокси-URL)
const VITE_BACKEND_URL: string | undefined = (import.meta as any)?.env?.VITE_BACKEND_URL;
let BACKEND_HOST: string | null = null;
try {
  if (VITE_BACKEND_URL) {
    BACKEND_HOST = new URL(VITE_BACKEND_URL).host;
  }
} catch {
  BACKEND_HOST = null;
}

// Приводим внешние абсолютные URL к локальному прокси пути, чтобы трафик шёл через Nginx
function normalizeToLocalProxy(url: string): string {
  try {
    if (!url || url.startsWith('blob:') || url.startsWith('/')) return url; // уже относительный/blob
    const parsed = new URL(url);
    // Если URL указывает на наш backend host (из VITE_BACKEND_URL) — переводим на относительный путь
    if (BACKEND_HOST && parsed.hostname === BACKEND_HOST) {
      // используем только путь и query, чтобы попасть под location /api/proxy/stickers/
      return `${parsed.pathname}${parsed.search}`;
    }
    // Если это абсолютный URL, но путь уже /api/proxy/stickers — тоже переводим на относительный
    if (parsed.pathname.startsWith('/api/proxy/stickers/')) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // не валидный абсолютный URL — возвращаем как есть
  }
  return url;
}

interface PriorityQueue {
  queue: Array<{ 
    fileId: string; 
    url: string; 
    packId: string; 
    imageIndex: number;
    resolve?: (value: string) => void;
    reject?: (error: Error) => void;
  }>;
  maxConcurrency: number;
  activeCount: number;
  lastLoadTime: number;
  failureCount: number; // Локальный счетчик неудач для этого приоритета
}

class ImageLoader {
  // Раздельные очереди по приоритетам для лучшего распараллеливания
  private priorityQueues: Map<number, PriorityQueue> = new Map();
  private inFlight: Map<string, Promise<string>> = new Map();
  private processingQueues: Set<number> = new Set(); // Отслеживание обрабатываемых очередей
  
  // Настройки параллельности по приоритетам
  private readonly CONCURRENCY_CONFIG = {
    [LoadPriority.TIER_0_MODAL]: 8,        // Модальное окно - высокая параллельность
    [LoadPriority.TIER_1_FIRST_6_PACKS]: 6, // Первые 6 паков - средняя параллельность
    [LoadPriority.TIER_2_FIRST_IMAGE]: 4,   // Первые изображения - средняя параллельность
    [LoadPriority.TIER_3_ADDITIONAL]: 3,    // Дополнительные - низкая параллельность
    [LoadPriority.TIER_4_BACKGROUND]: 2    // Фоновые - минимальная параллельность
  };
  
  // Базовые интервалы по приоритетам (без адаптации)
  private readonly BASE_INTERVALS = {
    [LoadPriority.TIER_0_MODAL]: 10,
    [LoadPriority.TIER_1_FIRST_6_PACKS]: 15,
    [LoadPriority.TIER_2_FIRST_IMAGE]: 25,
    [LoadPriority.TIER_3_ADDITIONAL]: 40,
    [LoadPriority.TIER_4_BACKGROUND]: 60
  };
  
  private readonly MAX_INTERVAL = 5000; // Максимальный интервал при rate limiting

  constructor() {
    // Инициализируем очереди для каждого приоритета
    Object.keys(this.CONCURRENCY_CONFIG).forEach(priority => {
      const prio = Number(priority);
      this.priorityQueues.set(prio, {
        queue: [],
        maxConcurrency: this.CONCURRENCY_CONFIG[prio],
        activeCount: 0,
        lastLoadTime: 0,
        failureCount: 0
      });
    });
  }

  async loadImage(
    fileId: string, 
    url: string, 
    priority: number = LoadPriority.TIER_3_ADDITIONAL,
    packId?: string,
    imageIndex?: number
  ): Promise<string> {
    // Проверить кеш
    const cached = imageCache.get(fileId);
    if (cached) {
      return cached;
    }

    // Проверить in-flight запросы (глобально для всех приоритетов)
    const existingPromise = this.inFlight.get(fileId);
    if (existingPromise) {
      return existingPromise;
    }

    // Получить очередь для этого приоритета
    const priorityQueue = this.priorityQueues.get(priority);
    if (!priorityQueue) {
      throw new Error(`Invalid priority: ${priority}`);
    }

    // Создать промис для этого запроса
    const promise = new Promise<string>((resolve, reject) => {
      // Добавить в очередь приоритета с колбэками
      priorityQueue.queue.push({ 
        fileId, 
        url, 
        packId: packId || '', 
        imageIndex: imageIndex || 0,
        resolve,
        reject
      } as any);
      
      // Запустить обработку очереди этого приоритета
      this.processPriorityQueue(priority);
    });
    
    this.inFlight.set(fileId, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      this.inFlight.delete(fileId);
    }
  }

  // Обработка очереди конкретного приоритета
  private async processPriorityQueue(priority: number): Promise<void> {
    const priorityQueue = this.priorityQueues.get(priority);
    if (!priorityQueue) return;

    // Защита от одновременной обработки одной очереди
    if (this.processingQueues.has(priority)) {
      return;
    }

    if (priorityQueue.activeCount >= priorityQueue.maxConcurrency) {
      return;
    }

    this.processingQueues.add(priority);

    try {
      while (priorityQueue.queue.length > 0 && priorityQueue.activeCount < priorityQueue.maxConcurrency) {
        const item = priorityQueue.queue.shift();
        if (!item) break;

        // Проверить, не загружается ли уже
        if (this.inFlight.has(item.fileId)) {
          continue;
        }

        // Вычисляем адаптивный интервал с учетом локальных неудач этого приоритета
        const now = Date.now();
        const timeSinceLastLoad = now - priorityQueue.lastLoadTime;
        
        const adaptiveMultiplier = Math.min(
          Math.pow(2, Math.floor(priorityQueue.failureCount / 3)), 
          this.MAX_INTERVAL / this.BASE_INTERVALS[priority]
        );
        const adaptiveInterval = Math.min(
          this.BASE_INTERVALS[priority] * adaptiveMultiplier, 
          this.MAX_INTERVAL
        );
        
        if (timeSinceLastLoad < adaptiveInterval) {
          // Добавляем обратно в начало очереди
          priorityQueue.queue.unshift(item);
          // Планируем повторную обработку через нужное время
          setTimeout(() => {
            this.processingQueues.delete(priority);
            this.processPriorityQueue(priority);
          }, adaptiveInterval - timeSinceLastLoad);
          return;
        }

        priorityQueue.activeCount++;
        priorityQueue.lastLoadTime = now;
        
        try {
          const promise = this.loadImageFromUrl(item.fileId, item.url, priority);
          this.inFlight.set(item.fileId, promise);
          
          promise
            .then((result) => {
              // Успешная загрузка - уменьшаем счетчик неудач этого приоритета
              if (priorityQueue.failureCount > 0) {
                priorityQueue.failureCount = Math.max(0, priorityQueue.failureCount - 1);
              }
              // Вызываем resolve колбэк если есть
              if (item.resolve) {
                item.resolve(result);
              }
            })
            .catch((error) => {
              // Ошибка - увеличиваем счетчик неудач только для этого приоритета
              priorityQueue.failureCount++;
              // Вызываем reject колбэк если есть
              if (item.reject) {
                item.reject(error);
              }
            })
            .finally(() => {
              priorityQueue.activeCount--;
              this.inFlight.delete(item.fileId);
              // Продолжаем обработку очереди
              if (!this.processingQueues.has(priority)) {
                this.processPriorityQueue(priority);
              }
            });
        } catch (error) {
          priorityQueue.activeCount--;
          priorityQueue.failureCount++;
          if (item.reject) {
            item.reject(error as Error);
          }
          console.warn('Failed to process queue item:', error);
        }
      }
    } finally {
      this.processingQueues.delete(priority);
    }
  }

  private async loadImageFromUrl(fileId: string, url: string, priority: number): Promise<string> {
    // Нормализуем URL к локальному прокси (если был абсолютный на бекенд)
    const normalizedUrl = normalizeToLocalProxy(url);

    // Проверяем валидность URL
    if (!normalizedUrl || (!normalizedUrl.startsWith('http') && !normalizedUrl.startsWith('blob:') && !normalizedUrl.startsWith('/'))) {
      throw new Error(`Invalid image URL: ${url}`);
    }
    
    // Логируем только в dev режиме
    if (import.meta.env.DEV) {
      console.log(`🔄 Prefetching image for ${fileId}:`, normalizedUrl);
    }
    
    // Retry логика с экспоненциальным backoff (оптимизировано для скорости)
    const maxRetries = 4;
    let delay = 300;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Реальная загрузка изображения через браузер
        const result = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          
          img.onload = () => {
            // Логируем только в dev режиме
            if (import.meta.env.DEV) {
              console.log(`✅ Image loaded for ${fileId}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
            }
            // Сохранить URL в кеш после успешной загрузки
            imageCache.set(fileId, normalizedUrl, 0.1);
            resolve(normalizedUrl);
          };
          
          img.onerror = () => {
            reject(new Error(`Failed to load image: ${normalizedUrl}`));
          };
          
          // Запускаем загрузку
          img.src = normalizedUrl;
        });
        
        return result;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        
        if (isLastAttempt) {
          // Логируем только в dev режиме, чтобы не засорять консоль в production
          if (import.meta.env.DEV) {
            const priorityQueue = this.priorityQueues.get(priority);
            const failureCount = priorityQueue?.failureCount || 0;
            console.warn(`❌ Failed to load image for ${fileId} after ${maxRetries} attempts. Priority: ${priority}, Failures: ${failureCount}`);
          }
          throw new Error(`Failed to load image after ${maxRetries} attempts: ${normalizedUrl}`);
        }
        
        // Логируем только в dev режиме
        if (import.meta.env.DEV) {
          const priorityQueue = this.priorityQueues.get(priority);
          const failureCount = priorityQueue?.failureCount || 0;
          console.warn(`⚠️ Retry ${attempt + 1}/${maxRetries} for ${fileId} after ${delay}ms delay (priority: ${priority}, failures: ${failureCount})`);
        }
        
        // Ждем перед следующей попыткой с экспоненциальным backoff
        // При большом количестве неудач этого приоритета увеличиваем задержку дополнительно
        const priorityQueue = this.priorityQueues.get(priority);
        const adaptiveDelay = delay * (1 + Math.min((priorityQueue?.failureCount || 0) / 10, 2));
        await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        
        // Удваиваем задержку для следующей попытки
        delay *= 2;
      }
    }
    
    // Этот код не должен выполниться, но TypeScript требует возврат
    throw new Error(`Failed to load image: ${normalizedUrl}`);
  }

  async reloadImage(
    fileId: string, 
    url: string, 
    priority: number = LoadPriority.TIER_3_ADDITIONAL,
    packId?: string,
    imageIndex?: number
  ): Promise<string> {
    // Удалить из кеша и перезагрузить
    imageCache.delete(fileId);
    return this.loadImage(fileId, url, priority, packId, imageIndex);
  }

  // Загрузить изображение с высоким приоритетом (для первых 6 паков)
  async loadHighPriorityImage(
    fileId: string, 
    url: string, 
    packId: string, 
    imageIndex: number = 0
  ): Promise<string> {
    const priority = imageIndex === 0 ? LoadPriority.TIER_2_FIRST_IMAGE : LoadPriority.TIER_3_ADDITIONAL;
    return this.loadImage(fileId, url, priority, packId, imageIndex);
  }

  // Загрузить фоновое изображение
  async loadBackgroundImage(
    fileId: string, 
    url: string, 
    packId: string, 
    imageIndex: number = 0
  ): Promise<string> {
    return this.loadImage(fileId, url, LoadPriority.TIER_4_BACKGROUND, packId, imageIndex);
  }

  abort(fileId: string): void {
    // Удалить из in-flight запросов
    this.inFlight.delete(fileId);
    
    // Удалить из всех очередей приоритетов
    this.priorityQueues.forEach(queue => {
      queue.queue = queue.queue.filter(item => item.fileId !== fileId);
    });
  }

  clear(): void {
    this.inFlight.clear();
    this.processingQueues.clear();
    this.priorityQueues.forEach(queue => {
      queue.queue = [];
      queue.activeCount = 0;
      queue.lastLoadTime = 0;
      queue.failureCount = 0;
    });
    imageCache.clear();
  }

  // Получить статистику очереди
  getQueueStats() {
    const stats: any = {
      inFlight: this.inFlight.size,
      totalQueued: 0,
      totalActive: 0
    };
    
    this.priorityQueues.forEach((queue, priority) => {
      stats[`priority_${priority}`] = {
        queued: queue.queue.length,
        active: queue.activeCount,
        maxConcurrency: queue.maxConcurrency,
        failures: queue.failureCount
      };
      stats.totalQueued += queue.queue.length;
      stats.totalActive += queue.activeCount;
    });
    
    return stats;
  }
}

// Глобальный экземпляр загрузчика
export const imageLoader = new ImageLoader();
