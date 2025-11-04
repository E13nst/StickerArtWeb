import { imageCache } from './galleryUtils';

interface LoaderQueue {
  inFlight: Map<string, Promise<string>>;
  queue: Array<{ fileId: string; url: string; priority: number; packId: string; imageIndex: number }>;
  maxConcurrency: number;
  activeCount: number;
}

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

class ImageLoader {
  private queue: LoaderQueue = {
    inFlight: new Map(),
    queue: [],
    maxConcurrency: 10,
    activeCount: 0
  };
  
  private processing = false;

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

    // Проверить in-flight запросы
    const existingPromise = this.queue.inFlight.get(fileId);
    if (existingPromise) {
      return existingPromise;
    }

    // Добавить в очередь с приоритетом
    this.addToQueue(fileId, url, priority, packId, imageIndex);
    
    // Создать новый запрос
    const promise = this.loadImageFromUrl(fileId, url);
    this.queue.inFlight.set(fileId, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.queue.inFlight.delete(fileId);
      this.processQueue();
    }
  }

  // Добавить в очередь с приоритетом
  private addToQueue(fileId: string, url: string, priority: number, packId?: string, imageIndex?: number): void {
    const queueItem = { fileId, url, priority, packId: packId || '', imageIndex: imageIndex || 0 };
    
    // Вставить в очередь с учетом приоритета
    const insertIndex = this.queue.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.queue.push(queueItem);
    } else {
      this.queue.queue.splice(insertIndex, 0, queueItem);
    }
  }

  // Обработка очереди
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.activeCount >= this.queue.maxConcurrency) {
      return;
    }

    this.processing = true;

    while (this.queue.queue.length > 0 && this.queue.activeCount < this.queue.maxConcurrency) {
      const item = this.queue.queue.shift();
      if (!item) break;

      // Проверить, не загружается ли уже
      if (this.queue.inFlight.has(item.fileId)) {
        continue;
      }

      this.queue.activeCount++;
      
      try {
        const promise = this.loadImageFromUrl(item.fileId, item.url);
        this.queue.inFlight.set(item.fileId, promise);
        
        promise.finally(() => {
          this.queue.activeCount--;
          this.queue.inFlight.delete(item.fileId);
          this.processQueue();
        });
      } catch (error) {
        this.queue.activeCount--;
        console.warn('Failed to process queue item:', error);
      }
    }

    this.processing = false;
  }

  private async loadImageFromUrl(fileId: string, url: string): Promise<string> {
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
    
    // Реальная загрузка изображения через браузер
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        // Логируем только в dev режиме
        if (import.meta.env.DEV) {
          console.log(`✅ Image loaded for ${fileId}`);
        }
        // Сохранить URL в кеш после успешной загрузки
        imageCache.set(fileId, normalizedUrl, 0.1);
        resolve(normalizedUrl);
      };
      
      img.onerror = () => {
        // Логируем только в dev режиме, чтобы не засорять консоль в production
        if (import.meta.env.DEV) {
          console.warn(`❌ Failed to load image for ${fileId}`);
        }
        reject(new Error(`Failed to load image: ${normalizedUrl}`));
      };
      
      // Запускаем загрузку
      img.src = normalizedUrl;
    });
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
    this.queue.inFlight.delete(fileId);
    
    // Удалить из очереди
    this.queue.queue = this.queue.queue.filter(item => item.fileId !== fileId);
  }

  clear(): void {
    this.queue.inFlight.clear();
    this.queue.queue = [];
    this.queue.activeCount = 0;
    this.processing = false;
    imageCache.clear();
  }

  // Получить статистику очереди
  getQueueStats() {
    return {
      inFlight: this.queue.inFlight.size,
      queued: this.queue.queue.length,
      active: this.queue.activeCount,
      maxConcurrency: this.queue.maxConcurrency
    };
  }
}

// Глобальный экземпляр загрузчика
export const imageLoader = new ImageLoader();
