import { imageCache } from './galleryUtils';
import { getStickerBaseUrl } from './stickerUtils';

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

const STICKER_BASE_URL = getStickerBaseUrl();
const STICKER_BASE_IS_ABSOLUTE = /^https?:\/\//i.test(STICKER_BASE_URL);

const CURRENT_ORIGIN = typeof window !== 'undefined' ? window.location.origin : null;

// Приводим внешние абсолютные URL к целевому пути (локальный /stickers или прямой URL)
function normalizeToStickerEndpoint(url: string): string {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  // Для абсолютной конфигурации ничего не нормализуем
  if (STICKER_BASE_IS_ABSOLUTE) {
    return url;
  }

  if (!STICKER_BASE_IS_ABSOLUTE && url.startsWith('http')) {
    try {
      const parsed = new URL(url);
      if (CURRENT_ORIGIN && parsed.origin === CURRENT_ORIGIN) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // игнорируем ошибки парсинга
    }
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
  
  // Отслеживание приоритетов активных загрузок для резервирования слотов
  private activePriorities: Map<string, number> = new Map(); // fileId -> priority
  
  // Резервирование слотов для высокоприоритетных загрузок
  // Гарантируем минимум 6 слотов для высокого приоритета (TIER_0, TIER_1, TIER_2)
  // Низкоприоритетные (TIER_3, TIER_4) используют оставшиеся слоты, но не более 4 одновременно
  private readonly HIGH_PRIORITY_MIN_SLOTS = 6; // Минимум слотов для высокого приоритета
  private readonly LOW_PRIORITY_MAX_SLOTS = 4;  // Максимум слотов для низкого приоритета
  private readonly HIGH_PRIORITY_THRESHOLD = LoadPriority.TIER_2_FIRST_IMAGE; // >= 3 = высокий приоритет

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

    // Проверить, не находится ли уже в очереди (защита от дублирования)
    const alreadyInQueue = this.queue.queue.some(item => item.fileId === fileId);
    if (alreadyInQueue) {
      // Если уже в очереди, создаем промис который будет разрешен когда элемент обработается
      return new Promise<string>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const cached = imageCache.get(fileId);
          if (cached) {
            clearInterval(checkInterval);
            resolve(cached);
            return;
          }
          
          const inFlight = this.queue.inFlight.get(fileId);
          if (inFlight) {
            clearInterval(checkInterval);
            inFlight.then(resolve).catch(reject);
            return;
          }
          
          // Если элемент исчез из очереди и нет в кеше - ошибка
          const stillInQueue = this.queue.queue.some(item => item.fileId === fileId);
          if (!stillInQueue && !cached) {
            clearInterval(checkInterval);
            reject(new Error('Image load failed'));
          }
        }, 100);
        
        // Таймаут на случай зависания
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for image load'));
        }, 30000);
      });
    }

    // Добавить в очередь с приоритетом
    this.addToQueue(fileId, url, priority, packId, imageIndex);
    
    // Запустить обработку очереди (она создаст промис и добавит в inFlight)
    this.processQueue();
    
    // Ждем пока элемент будет обработан и появится в inFlight
    // Используем промис из inFlight когда он появится
    return new Promise<string>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100; // Максимум 5 секунд (100 * 50ms)
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        // Проверяем кеш
        const cached = imageCache.get(fileId);
        if (cached) {
          clearInterval(checkInterval);
          resolve(cached);
          return;
        }
        
        // Проверяем in-flight
        const inFlight = this.queue.inFlight.get(fileId);
        if (inFlight) {
          clearInterval(checkInterval);
          inFlight.then(resolve).catch(reject);
          return;
        }
        
        // Если элемент исчез из очереди и нет в кеше - возможно ошибка
        const stillInQueue = this.queue.queue.some(item => item.fileId === fileId);
        if (!stillInQueue && !cached && attempts > 10) {
          clearInterval(checkInterval);
          reject(new Error('Image load failed or removed from queue'));
          return;
        }
        
        // Таймаут
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for image load'));
        }
      }, 50);
    });
  }

  // Добавить в очередь с приоритетом
  private addToQueue(fileId: string, url: string, priority: number, packId?: string, imageIndex?: number): void {
    // Проверка на дублирование перед добавлением
    const exists = this.queue.queue.some(item => item.fileId === fileId);
    if (exists) {
      return; // Уже в очереди, не добавляем дубликат
    }
    
    const queueItem = { fileId, url, priority, packId: packId || '', imageIndex: imageIndex || 0 };
    
    // Вставить в очередь с учетом приоритета
    const insertIndex = this.queue.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.queue.push(queueItem);
    } else {
      this.queue.queue.splice(insertIndex, 0, queueItem);
    }
  }

  // Подсчет активных загрузок по приоритетам
  private getActiveCountsByPriority(): { high: number; low: number } {
    let high = 0;
    let low = 0;
    
    // Подсчитываем активные загрузки по приоритетам из activePriorities Map
    for (const priority of this.activePriorities.values()) {
      if (priority >= this.HIGH_PRIORITY_THRESHOLD) {
        high++;
      } else {
        low++;
      }
    }
    
    return { high, low };
  }

  // Обработка очереди с резервированием слотов для высокого приоритета
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.activeCount >= this.queue.maxConcurrency) {
      return;
    }

    this.processing = true;

    // Подсчитываем активные загрузки по приоритетам
    const activeByPriority = this.getActiveCountsByPriority();
    
    // Разделяем очередь на высокоприоритетные и низкоприоритетные элементы
    const highPriorityItems: typeof this.queue.queue = [];
    const lowPriorityItems: typeof this.queue.queue = [];
    
    for (const item of this.queue.queue) {
      if (item.priority >= this.HIGH_PRIORITY_THRESHOLD) {
        highPriorityItems.push(item);
      } else {
        lowPriorityItems.push(item);
      }
    }
    
    // Логирование для отладки (только в dev режиме)
    if (import.meta.env.DEV && (highPriorityItems.length > 0 || lowPriorityItems.length > 0)) {
      console.log(`📊 Queue processing: high=${highPriorityItems.length}, low=${lowPriorityItems.length}, active=${this.queue.activeCount}, activeHigh=${activeByPriority.high}, activeLow=${activeByPriority.low}`);
    }

    // Сначала обрабатываем высокоприоритетные элементы
    // Обрабатываем пока есть элементы и есть свободные слоты
    while (
      highPriorityItems.length > 0 && 
      this.queue.activeCount < this.queue.maxConcurrency
    ) {
      // Проверяем текущее количество активных высокоприоритетных загрузок
      const currentActive = this.getActiveCountsByPriority();
      
      // Если есть низкоприоритетные элементы в очереди И уже достигнут минимум для высокого приоритета
      // И занято достаточно слотов - резервируем место для низкоприоритетных
      if (lowPriorityItems.length > 0 &&
          currentActive.high >= this.HIGH_PRIORITY_MIN_SLOTS && 
          this.queue.activeCount >= this.queue.maxConcurrency - this.LOW_PRIORITY_MAX_SLOTS) {
        break; // Резервируем место для низкоприоритетных
      }
      
      const item = highPriorityItems.shift();
      if (!item) break;

      // Проверить, не загружается ли уже
      if (this.queue.inFlight.has(item.fileId)) {
        continue;
      }

      // Удаляем из основной очереди
      const index = this.queue.queue.findIndex(q => q.fileId === item.fileId);
      if (index !== -1) {
        this.queue.queue.splice(index, 1);
      }

      this.queue.activeCount++;
      this.activePriorities.set(item.fileId, item.priority);
      
      try {
        const promise = this.loadImageFromUrl(item.fileId, item.url);
        this.queue.inFlight.set(item.fileId, promise);
        
        promise.finally(() => {
          this.queue.activeCount--;
          this.queue.inFlight.delete(item.fileId);
          this.activePriorities.delete(item.fileId);
          this.processQueue();
        });
      } catch (error) {
        this.queue.activeCount--;
        this.activePriorities.delete(item.fileId);
        console.warn('Failed to process queue item:', error);
      }
    }

    // Затем обрабатываем низкоприоритетные элементы (если есть свободные слоты)
    while (
      lowPriorityItems.length > 0 && 
      this.queue.activeCount < this.queue.maxConcurrency
    ) {
      // Проверяем текущее количество активных низкоприоритетных загрузок
      const currentActive = this.getActiveCountsByPriority();
      
      // Если достигнут максимум для низкого приоритета - выходим
      if (currentActive.low >= this.LOW_PRIORITY_MAX_SLOTS) {
        break;
      }
      
      const item = lowPriorityItems.shift();
      if (!item) break;

      // Проверить, не загружается ли уже
      if (this.queue.inFlight.has(item.fileId)) {
        continue;
      }

      // Удаляем из основной очереди
      const index = this.queue.queue.findIndex(q => q.fileId === item.fileId);
      if (index !== -1) {
        this.queue.queue.splice(index, 1);
      }

      this.queue.activeCount++;
      this.activePriorities.set(item.fileId, item.priority);
      
      try {
        const promise = this.loadImageFromUrl(item.fileId, item.url);
        this.queue.inFlight.set(item.fileId, promise);
        
        promise.finally(() => {
          this.queue.activeCount--;
          this.queue.inFlight.delete(item.fileId);
          this.activePriorities.delete(item.fileId);
          this.processQueue();
        });
      } catch (error) {
        this.queue.activeCount--;
        this.activePriorities.delete(item.fileId);
        console.warn('Failed to process queue item:', error);
      }
    }

    this.processing = false;
  }

  private async loadImageFromUrl(fileId: string, url: string): Promise<string> {
    // Нормализуем URL к целевому эндпоинту (устраняем абсолютные backend-URL)
    const normalizedUrl = normalizeToStickerEndpoint(url);

    // Проверяем валидность URL
    if (!normalizedUrl || (!normalizedUrl.startsWith('http') && !normalizedUrl.startsWith('blob:') && !normalizedUrl.startsWith('/'))) {
      throw new Error(`Invalid image URL: ${url}`);
    }
    
    // Логируем только в dev режиме
    if (import.meta.env.DEV) {
      console.log(`🔄 Prefetching image for ${fileId}:`, normalizedUrl);
    }
    
    // Retry логика с экспоненциальным backoff
    const maxRetries = 6;
    let delay = 1000; // Начинаем с 1 секунды
    
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
            console.warn(`❌ Failed to load image for ${fileId} after ${maxRetries} attempts`);
          }
          throw new Error(`Failed to load image after ${maxRetries} attempts: ${normalizedUrl}`);
        }
        
        // Логируем только финальную попытку в dev режиме (чтобы не засорять консоль)
        if (import.meta.env.DEV && attempt === maxRetries - 2) {
          console.warn(`⚠️ Retry ${attempt + 1}/${maxRetries} for ${fileId} after ${delay}ms delay`);
        }
        
        // Ждем перед следующей попыткой с экспоненциальным backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        
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
    this.queue.inFlight.delete(fileId);
    this.activePriorities.delete(fileId);
    
    // Удалить из очереди
    this.queue.queue = this.queue.queue.filter(item => item.fileId !== fileId);
  }

  clear(): void {
    this.queue.inFlight.clear();
    this.activePriorities.clear();
    this.queue.queue = [];
    this.queue.activeCount = 0;
    this.processing = false;
    imageCache.clear();
  }

  // Получить статистику очереди
  getQueueStats() {
    const activeByPriority = this.getActiveCountsByPriority();
    const highPriorityQueued = this.queue.queue.filter(item => item.priority >= this.HIGH_PRIORITY_THRESHOLD).length;
    const lowPriorityQueued = this.queue.queue.filter(item => item.priority < this.HIGH_PRIORITY_THRESHOLD).length;
    
    return {
      inFlight: this.queue.inFlight.size,
      queued: this.queue.queue.length,
      queuedHigh: highPriorityQueued,
      queuedLow: lowPriorityQueued,
      active: this.queue.activeCount,
      activeHigh: activeByPriority.high,
      activeLow: activeByPriority.low,
      maxConcurrency: this.queue.maxConcurrency,
      reservedHigh: this.HIGH_PRIORITY_MIN_SLOTS,
      reservedLow: this.LOW_PRIORITY_MAX_SLOTS
    };
  }
}

// Глобальный экземпляр загрузчика
export const imageLoader = new ImageLoader();
