import { getStickerBaseUrl } from './stickerUtils';
import { cacheManager } from './cacheManager';
import type { ResourceType } from './cacheManager';

// Реэкспорт для обратной совместимости
export type { ResourceType };

// Type helper для import.meta
const isDev = (import.meta as any).env?.DEV;

interface QueueItem {
  fileId: string;
  url: string;
  normalizedUrl: string; // 🔥 НОВОЕ: Нормализованный URL для dedupe
  priority: number;
  packId: string;
  imageIndex: number;
  resourceType: ResourceType; // Новое поле
}

interface LoaderQueue {
  inFlight: Map<string, Promise<string>>;
  queue: Array<QueueItem>;
  maxConcurrency: number;
  activeCount: number;
}

interface PendingResolver {
  resolve: (url: string) => void;
  reject: (error: Error) => void;
}

// Приоритеты загрузки
/**
 * Приоритеты загрузки (обновленная viewport-based система):
 * - TIER_0_MODAL: Наивысший (для модального окна)
 * - TIER_1_VIEWPORT: Элементы видимые в viewport прямо сейчас
 * - TIER_2_NEAR_VIEWPORT: Элементы близко к viewport (в пределах 800px)
 * - TIER_3_ADDITIONAL: Остальные загруженные (ротация, предзагрузка)
 * - TIER_4_BACKGROUND: Фоновая предзагрузка вне зоны видимости
 * 
 * 🔥 НОВОЕ: Приоритет теперь динамический - меняется при скролле!
 */
export enum LoadPriority {
  TIER_0_MODAL = 5,              // Наивысший (модальное окно)
  TIER_1_VIEWPORT = 4,           // Видимые в viewport прямо сейчас
  TIER_2_NEAR_VIEWPORT = 3,      // В пределах 800px от viewport
  TIER_3_ADDITIONAL = 2,         // Остальные (ротация, предзагрузка)
  TIER_4_BACKGROUND = 1,         // Фоновые
}

const STICKER_BASE_URL = getStickerBaseUrl();
const STICKER_BASE_IS_ABSOLUTE = /^https?:\/\//i.test(STICKER_BASE_URL);

const CURRENT_ORIGIN = typeof window !== 'undefined' ? window.location.origin : null;

/**
 * 🔥 ОПТИМИЗАЦИЯ: Нормализация URL для устранения дубликатов
 * - Приводит к целевому эндпоинту (локальный /stickers или прямой URL)
 * - Удаляет версионные query-параметры (v, _, timestamp)
 * - Сортирует оставшиеся параметры для единообразия
 */
function normalizeToStickerEndpoint(url: string): string {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  // Для абсолютной конфигурации нормализуем query-параметры
  if (STICKER_BASE_IS_ABSOLUTE) {
    return normalizeQueryParams(url);
  }

  if (!STICKER_BASE_IS_ABSOLUTE && url.startsWith('http')) {
    try {
      const parsed = new URL(url);
      if (CURRENT_ORIGIN && parsed.origin === CURRENT_ORIGIN) {
        const normalized = `${parsed.pathname}${parsed.search}`;
        return normalizeQueryParams(normalized);
      }
    } catch {
      // игнорируем ошибки парсинга
    }
  }

  return normalizeQueryParams(url);
}

/**
 * 🔥 НОВОЕ: Нормализация query-параметров для устранения дубликатов
 * Удаляет версионные параметры и сортирует остальные
 */
function normalizeQueryParams(url: string): string {
  try {
    // Если нет query-параметров, возвращаем как есть
    if (!url.includes('?')) {
      return url;
    }

    const parsed = new URL(url, CURRENT_ORIGIN || 'http://localhost');
    
    // Удаляем версионные и кеш-бастинг параметры
    parsed.searchParams.delete('v');
    parsed.searchParams.delete('_');
    parsed.searchParams.delete('t');
    parsed.searchParams.delete('timestamp');
    
    // Сортируем оставшиеся параметры для единообразия
    parsed.searchParams.sort();
    
    // Возвращаем pathname + отсортированные параметры
    const search = parsed.search;
    return `${parsed.pathname}${search}`;
  } catch {
    // Если не удалось распарсить, возвращаем как есть
    return url;
  }
}

// ✅ P1 OPTIMIZATION: Расширение типов для Network Information API
interface NetworkInformation extends EventTarget {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

class ImageLoader {
  private queue: LoaderQueue = {
    inFlight: new Map(),
    queue: [],
    maxConcurrency: 30, // 🔥 УВЕЛИЧЕНО: до 30 для поддержки 40 карточек одновременно
    activeCount: 0
  };
  
  private processing = false;
  
  // Отслеживание приоритетов активных загрузок для резервирования слотов
  private activePriorities: Map<string, number> = new Map(); // fileId -> priority
  
  // 🔥 НОВОЕ: Хранение resolver'ов для предотвращения race condition
  private pendingResolvers = new Map<string, PendingResolver>();
  
  // 🔥 ОПТИМИЗАЦИЯ: Dedupe по нормализованным URL (не только по fileId)
  // Это предотвращает загрузку одного и того же ресурса с разными query-параметрами
  private urlInFlight: Map<string, Promise<string>> = new Map();
  
  // Резервирование слотов для высокоприоритетных загрузок
  // Гарантируем минимум 6 слотов для высокого приоритета (TIER_0, TIER_1, TIER_2)
  // Низкоприоритетные (TIER_3, TIER_4) используют оставшиеся слоты
  private readonly HIGH_PRIORITY_MIN_SLOTS = 6;  // Минимум для высокого приоритета
  private readonly LOW_PRIORITY_MAX_SLOTS = 18; // 🔥 УВЕЛИЧЕНО: с 12 до 18 для поддержки 40 карточек!
  private readonly HIGH_PRIORITY_THRESHOLD = LoadPriority.TIER_2_NEAR_VIEWPORT; // >= 3 = высокий приоритет
  
  constructor() {
    // ✅ P1 OPTIMIZATION: Адаптивная concurrency на основе типа сети
    this.updateConcurrencyBasedOnNetwork();
    
    // Слушаем изменения сети
    this.listenToNetworkChanges();
  }
  
  /**
   * Определяет оптимальную concurrency на основе Network Information API
   */
  private getOptimalConcurrency(): number {
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (!connection) {
      // 🔥 ФИКС: Нет API - используем высокие значения для современных браузеров
      return 30; // 🔥 УВЕЛИЧЕНО: до 30 для поддержки 40 карточек
    }
    
    const effectiveType = connection.effectiveType;
    const rtt = connection.rtt; // Round Trip Time в ms
    const saveData = connection.saveData; // Режим экономии трафика
    
    // Если включен режим экономии трафика - минимальная concurrency
    if (saveData) {
      return 15; // 🔥 УВЕЛИЧЕНО: даже в режиме экономии загружаем больше
    }
    
    // Определяем на основе типа сети
    if (effectiveType === 'slow-2g' || (rtt && rtt > 1000)) {
      return 10; // 🔥 УВЕЛИЧЕНО: для очень медленной сети
    }
    if (effectiveType === '2g' || (rtt && rtt > 500)) {
      return 15; // 🔥 УВЕЛИЧЕНО: для медленной сети
    }
    if (effectiveType === '3g' || (rtt && rtt > 200)) {
      return 25; // 🔥 УВЕЛИЧЕНО: для средней сети
    }
    if (effectiveType === '4g' || (rtt && rtt <= 200)) {
      return 30; // 🔥 УВЕЛИЧЕНО: для быстрой сети
    }
    
    // Default для неизвестных значений
    return 30; // 🔥 УВЕЛИЧЕНО: до 30
  }
  
  /**
   * Обновляет maxConcurrency на основе текущего типа сети
   */
  private updateConcurrencyBasedOnNetwork(): void {
    const newConcurrency = this.getOptimalConcurrency();
    
    if (this.queue.maxConcurrency !== newConcurrency) {
      console.log(`[ImageLoader] Concurrency updated: ${this.queue.maxConcurrency} → ${newConcurrency}`);
      this.queue.maxConcurrency = newConcurrency;
      
      // Если увеличили concurrency - запускаем процесс загрузки
      if (!this.processing) {
        this.processQueue();
      }
    }
  }
  
  /**
   * Подписываемся на изменения типа сети
   */
  private listenToNetworkChanges(): void {
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (connection && 'addEventListener' in connection) {
      connection.addEventListener('change', () => {
        this.updateConcurrencyBasedOnNetwork();
      });
    }
  }

  /**
   * 🔥 УНИФИЦИРОВАННЫЙ метод загрузки ВСЕХ типов ресурсов
   * Поддерживает: изображения, анимации (JSON), видео (blob)
   */
  async loadResource(
    fileId: string, 
    url: string, 
    resourceType: ResourceType = 'image',
    priority: number = LoadPriority.TIER_3_ADDITIONAL,
    packId?: string,
    imageIndex?: number
  ): Promise<string> {
    if (isDev) {
      console.log(`🔵 loadResource called: ${resourceType} ${fileId.substring(0, 20)}... URL: ${url.substring(0, 50)}...`);
    }
    
    // 🔥 ОПТИМИЗАЦИЯ: Нормализуем URL ОДИН РАЗ в начале
    const normalizedUrl = normalizeToStickerEndpoint(url);
    
    // 1. Проверить соответствующий кеш в зависимости от типа
    const cached = await this.getCachedResource(fileId, resourceType);
    if (cached) {
      if (isDev) {
        console.log(`✅ Cache hit for ${resourceType}: ${fileId.substring(0, 20)}...`);
      }
      return cached;
    }

    if (isDev) {
      console.log(`❌ NOT in cache: ${resourceType} ${fileId.substring(0, 20)}...`);
    }

    // 2. 🔥 ОПТИМИЗАЦИЯ: Проверить dedupe по fileId
    const existingPromise = this.queue.inFlight.get(fileId);
    if (existingPromise) {
      if (isDev) {
        console.log(`🔄 Dedupe by fileId: returning existing promise for ${resourceType}: ${fileId.substring(0, 20)}...`);
      }
      return existingPromise;
    }

    // 3. 🔥 ОПТИМИЗАЦИЯ: Проверить dedupe по нормализованному URL
    // Это предотвращает загрузку одного URL с разными query-параметрами
    const existingUrlPromise = this.urlInFlight.get(normalizedUrl);
    if (existingUrlPromise) {
      if (isDev) {
        console.log(`🔄 Dedupe by URL: returning existing promise for ${normalizedUrl.substring(0, 50)}...`);
      }
      // Сохраняем промис и для этого fileId
      this.queue.inFlight.set(fileId, existingUrlPromise);
      return existingUrlPromise;
    }

    // 4. 🔥 ФИКС: Создаем промис СРАЗУ и сохраняем ПЕРЕД добавлением в очередь
    // Это предотвращает race condition когда два компонента одновременно запрашивают один ресурс
    const loadPromise = new Promise<string>((resolve, reject) => {
      this.pendingResolvers.set(fileId, { resolve, reject });
    });
    
    // Сохраняем промис НЕМЕДЛЕННО чтобы последующие вызовы вернули его
    this.queue.inFlight.set(fileId, loadPromise);
    this.urlInFlight.set(normalizedUrl, loadPromise); // 🔥 НОВОЕ: Dedupe по URL
    
    if (isDev) {
      console.log(`📥 Queuing ${resourceType}: ${fileId.substring(0, 20)}... with priority ${priority}, normalized URL: ${normalizedUrl.substring(0, 60)}...`);
    }

    // 5. Добавить в очередь (теперь безопасно, inFlight уже установлен)
    this.addToQueue(fileId, url, normalizedUrl, priority, packId, imageIndex, resourceType);
    
    // 6. Запустить обработку очереди
    this.processQueue();

    return loadPromise;
  }

  /**
   * Обратная совместимость: loadImage теперь использует loadResource
   */
  async loadImage(
    fileId: string, 
    url: string, 
    priority: number = LoadPriority.TIER_3_ADDITIONAL,
    packId?: string,
    imageIndex?: number
  ): Promise<string> {
    return this.loadResource(fileId, url, 'image', priority, packId, imageIndex);
  }

  /**
   * 🔥 НОВОЕ: Загрузка анимации (JSON) через единую систему
   */
  async loadAnimation(
    fileId: string, 
    url: string, 
    priority: number = LoadPriority.TIER_3_ADDITIONAL,
    packId?: string,
    imageIndex?: number
  ): Promise<string> {
    return this.loadResource(fileId, url, 'animation', priority, packId, imageIndex);
  }

  /**
   * 🔥 НОВОЕ: Загрузка видео (blob) через единую систему
   */
  async loadVideo(
    fileId: string, 
    url: string, 
    priority: number = LoadPriority.TIER_3_ADDITIONAL,
    packId?: string,
    imageIndex?: number
  ): Promise<string> {
    return this.loadResource(fileId, url, 'video', priority, packId, imageIndex);
  }

  /**
   * Получить закешированный ресурс в зависимости от типа
   */
  private async getCachedResource(fileId: string, resourceType: ResourceType): Promise<string | undefined> {
    try {
      const cached = await cacheManager.get(fileId, resourceType);
      if (cached) {
        // Для анимаций возвращаем fileId как индикатор успеха
        return resourceType === 'animation' ? fileId : cached;
      }
      return undefined;
    } catch (error) {
      if (isDev) {
        console.warn(`Failed to get cached ${resourceType}:`, error);
      }
      return undefined;
    }
  }

  /**
   * 🔥 НОВОЕ: Проверка загружается ли или закеширован ли ресурс (синхронная)
   */
  isLoadingOrCached(fileId: string, resourceType: ResourceType = 'image'): boolean {
    const cached = cacheManager.has(fileId, resourceType);
    return cached || 
           this.queue.inFlight.has(fileId) ||
           this.queue.queue.some(item => item.fileId === fileId);
  }

  // Добавить в очередь с приоритетом
  private addToQueue(
    fileId: string, 
    url: string, 
    normalizedUrl: string, // 🔥 НОВОЕ: передаем нормализованный URL
    priority: number, 
    packId?: string, 
    imageIndex?: number,
    resourceType: ResourceType = 'image'
  ): void {
    // Проверка на дублирование перед добавлением
    const exists = this.queue.queue.some(item => item.fileId === fileId);
    if (exists) {
      if (isDev) {
        console.log(`⚠️ Prevented duplicate queue entry for ${fileId}`);
      }
      return; // Уже в очереди, не добавляем дубликат
    }
    
    const queueItem: QueueItem = { 
      fileId, 
      url, 
      normalizedUrl, // 🔥 НОВОЕ: сохраняем нормализованный URL
      priority, 
      packId: packId || '', 
      imageIndex: imageIndex || 0,
      resourceType // 🔥 НОВОЕ: сохраняем тип ресурса
    };
    
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
    if (isDev && (highPriorityItems.length > 0 || lowPriorityItems.length > 0)) {
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

      // 🔥 ФИКС: Убрали проверку inFlight, потому что:
      // - inFlight теперь означает "промис создан, ожидает реальной загрузки"
      // - Дедупликация происходит ТОЛЬКО в loadResource(), не здесь
      // - Здесь мы РЕАЛЬНО запускаем загрузку
      
      if (isDev) {
        console.log(`🚀 STARTING to load ${item.resourceType}: ${item.fileId.substring(0, 20)}... priority=${item.priority}`);
      }

      // Удаляем из основной очереди
      const index = this.queue.queue.findIndex(q => q.fileId === item.fileId);
      if (index !== -1) {
        this.queue.queue.splice(index, 1);
      }

      this.queue.activeCount++;
      this.activePriorities.set(item.fileId, item.priority);
      
      try {
        // 🔥 ОПТИМИЗАЦИЯ: Используем нормализованный URL из QueueItem
        this.loadResourceFromUrl(item.fileId, item.normalizedUrl, item.resourceType)
          .then((url) => {
            // ✅ Разрешаем промис через сохраненный resolver
            const resolver = this.pendingResolvers.get(item.fileId);
            if (resolver) {
              resolver.resolve(url);
              this.pendingResolvers.delete(item.fileId);
            }
          })
          .catch((error) => {
            // ❌ Отклоняем промис через сохраненный resolver
            const resolver = this.pendingResolvers.get(item.fileId);
            if (resolver) {
              resolver.reject(error);
              this.pendingResolvers.delete(item.fileId);
            }
          })
          .finally(() => {
            this.queue.activeCount--;
            this.queue.inFlight.delete(item.fileId);
            this.urlInFlight.delete(item.normalizedUrl); // 🔥 НОВОЕ: Очищаем dedupe по URL
            this.activePriorities.delete(item.fileId);
            this.processQueue();
          });
      } catch (error) {
        this.queue.activeCount--;
        this.activePriorities.delete(item.fileId);
        const resolver = this.pendingResolvers.get(item.fileId);
        if (resolver) {
          resolver.reject(error instanceof Error ? error : new Error('Unknown error'));
          this.pendingResolvers.delete(item.fileId);
        }
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

      // 🔥 ФИКС: Убрали проверку inFlight (см. комментарий выше)
      
      if (isDev) {
        console.log(`🚀 STARTING to load ${item.resourceType}: ${item.fileId.substring(0, 20)}... priority=${item.priority}`);
      }

      // Удаляем из основной очереди
      const index = this.queue.queue.findIndex(q => q.fileId === item.fileId);
      if (index !== -1) {
        this.queue.queue.splice(index, 1);
      }

      this.queue.activeCount++;
      this.activePriorities.set(item.fileId, item.priority);
      
      try {
        // 🔥 ОПТИМИЗАЦИЯ: Используем нормализованный URL из QueueItem
        this.loadResourceFromUrl(item.fileId, item.normalizedUrl, item.resourceType)
          .then((url) => {
            // ✅ Разрешаем промис через сохраненный resolver
            const resolver = this.pendingResolvers.get(item.fileId);
            if (resolver) {
              resolver.resolve(url);
              this.pendingResolvers.delete(item.fileId);
            }
          })
          .catch((error) => {
            // ❌ Отклоняем промис через сохраненный resolver
            const resolver = this.pendingResolvers.get(item.fileId);
            if (resolver) {
              resolver.reject(error);
              this.pendingResolvers.delete(item.fileId);
            }
          })
          .finally(() => {
            this.queue.activeCount--;
            this.queue.inFlight.delete(item.fileId);
            this.urlInFlight.delete(item.normalizedUrl); // 🔥 НОВОЕ: Очищаем dedupe по URL
            this.activePriorities.delete(item.fileId);
            this.processQueue();
          });
      } catch (error) {
        this.queue.activeCount--;
        this.activePriorities.delete(item.fileId);
        const resolver = this.pendingResolvers.get(item.fileId);
        if (resolver) {
          resolver.reject(error instanceof Error ? error : new Error('Unknown error'));
          this.pendingResolvers.delete(item.fileId);
        }
        console.warn('Failed to process queue item:', error);
      }
    }

    this.processing = false;
  }

  /**
   * 🔥 УНИФИЦИРОВАННЫЙ метод загрузки ресурса по URL
   * Поддерживает: изображения, анимации (JSON), видео (blob)
   */
  private async loadResourceFromUrl(fileId: string, url: string, resourceType: ResourceType): Promise<string> {
    switch (resourceType) {
      case 'image':
        return this.loadImageFromUrl(fileId, url);
      case 'animation':
        return this.loadAnimationFromUrl(fileId, url);
      case 'video':
        return this.loadVideoFromUrl(fileId, url);
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Загрузка изображения (оригинальный метод)
   * 🔥 ОПТИМИЗАЦИЯ: URL уже нормализован в loadResource(), не нормализуем повторно
   */
  private async loadImageFromUrl(fileId: string, normalizedUrl: string): Promise<string> {
    // Проверяем валидность URL
    if (!normalizedUrl || (!normalizedUrl.startsWith('http') && !normalizedUrl.startsWith('blob:') && !normalizedUrl.startsWith('/'))) {
      console.error(`❌ Invalid image URL: ${normalizedUrl}`);
      throw new Error(`Invalid image URL: ${normalizedUrl}`);
    }
    
    // Логируем только в dev режиме
    if (isDev) {
      console.log(`🔄 STARTING Prefetch image for ${fileId.substring(0, 20)}...: ${normalizedUrl.substring(0, 80)}...`);
    }
    
    // Retry логика с экспоненциальным backoff
    const maxRetries = 6;
    let delay = 1000; // Начинаем с 1 секунды
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Реальная загрузка изображения через браузер с timeout
        const result = await Promise.race([
          new Promise<string>((resolve, reject) => {
            const img = new Image();
            
            img.onload = async () => {
              // Логируем только в dev режиме
              if (isDev) {
                console.log(`✅ Image loaded for ${fileId}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
              }
              // Сохранить URL в кеш после успешной загрузки
              try {
                await cacheManager.set(fileId, normalizedUrl, 'image');
              } catch (error) {
                if (isDev) {
                  console.warn('Failed to cache image:', error);
                }
              }
              resolve(normalizedUrl);
            };
            
            img.onerror = () => {
              reject(new Error(`Failed to load image: ${normalizedUrl}`));
            };
            
            // Запускаем загрузку
            img.src = normalizedUrl;
          }),
          // 🔥 FIX: Увеличили timeout с 20s до 30s чтобы медленные стикеры успевали загрузиться
          // Это уменьшает количество ненужных retries и дубликатов
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Image load timeout')), 30000);
          })
        ]);
        
        return result;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        
        if (isLastAttempt) {
          // Логируем только в dev режиме, чтобы не засорять консоль в production
          if (isDev) {
            console.warn(`❌ Failed to load image for ${fileId} after ${maxRetries} attempts`);
          }
          throw new Error(`Failed to load image after ${maxRetries} attempts: ${normalizedUrl}`);
        }
        
        // Логируем только финальную попытку в dev режиме (чтобы не засорять консоль)
        if (isDev && attempt === maxRetries - 2) {
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

  /**
   * 🔥 НОВОЕ: Загрузка анимации (JSON) из URL
   * 🔥 ОПТИМИЗАЦИЯ: URL уже нормализован в loadResource(), не нормализуем повторно
   */
  private async loadAnimationFromUrl(fileId: string, normalizedUrl: string): Promise<string> {
    if (isDev) {
      console.log(`🎬 Fetching animation JSON for ${fileId}:`, normalizedUrl);
    }
    
    const maxRetries = 3;
    let delay = 1000;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(normalizedUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        
        const data = await response.json();
        
        // Сохраняем в кеш анимаций
        try {
          await cacheManager.set(fileId, data, 'animation');
        } catch (error) {
          if (isDev) {
            console.warn('Failed to cache animation:', error);
          }
        }
        
        if (isDev) {
          console.log(`✅ Animation JSON loaded for ${fileId}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
        }
        
        // Возвращаем fileId как индикатор успешной загрузки
        return fileId;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        
        if (isLastAttempt) {
          if (isDev) {
            console.warn(`❌ Failed to load animation for ${fileId} after ${maxRetries} attempts`);
          }
          throw new Error(`Failed to load animation after ${maxRetries} attempts: ${normalizedUrl}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    
    throw new Error(`Failed to load animation: ${normalizedUrl}`);
  }

  /**
   * 🔥 НОВОЕ: Загрузка видео (blob) из URL
   * 🔥 ОПТИМИЗАЦИЯ: URL уже нормализован в loadResource(), не нормализуем повторно
   */
  private async loadVideoFromUrl(fileId: string, normalizedUrl: string): Promise<string> {
    if (isDev) {
      console.log(`🎬 Fetching video blob for ${fileId}:`, normalizedUrl);
    }
    
    const maxRetries = 3;
    let delay = 1000;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(normalizedUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        // Сохраняем в кеш видео
        // Очищаем старый blob URL если существует
        const existingUrl = await cacheManager.get(fileId, 'video');
        if (existingUrl && existingUrl !== objectUrl) {
          URL.revokeObjectURL(existingUrl);
        }
        
        try {
          await cacheManager.set(fileId, objectUrl, 'video');
        } catch (error) {
          if (isDev) {
            console.warn('Failed to cache video:', error);
          }
        }
        
        if (isDev) {
          console.log(`✅ Video blob loaded for ${fileId}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
        }
        
        return objectUrl;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        
        if (isLastAttempt) {
          if (isDev) {
            console.warn(`❌ Failed to load video for ${fileId} after ${maxRetries} attempts`);
          }
          throw new Error(`Failed to load video after ${maxRetries} attempts: ${normalizedUrl}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    
    throw new Error(`Failed to load video: ${normalizedUrl}`);
  }

  async reloadImage(
    fileId: string, 
    url: string, 
    priority: number = LoadPriority.TIER_3_ADDITIONAL,
    packId?: string,
    imageIndex?: number
  ): Promise<string> {
    // Удалить из кеша и перезагрузить
    await cacheManager.delete(fileId, 'image');
    return this.loadImage(fileId, url, priority, packId, imageIndex);
  }

  // Загрузить изображение с высоким приоритетом (для первых 6 паков)
  async loadHighPriorityImage(
    fileId: string, 
    url: string, 
    packId: string, 
    imageIndex: number = 0
  ): Promise<string> {
    const priority = imageIndex === 0 ? LoadPriority.TIER_2_NEAR_VIEWPORT : LoadPriority.TIER_3_ADDITIONAL;
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
    
    // 🔥 ОПТИМИЗАЦИЯ: Удалить из urlInFlight (если есть)
    const queueItem = this.queue.queue.find(item => item.fileId === fileId);
    if (queueItem) {
      this.urlInFlight.delete(queueItem.normalizedUrl);
    }
    
    // Удалить из очереди
    this.queue.queue = this.queue.queue.filter(item => item.fileId !== fileId);
  }

  async clear(): Promise<void> {
    this.queue.inFlight.clear();
    this.urlInFlight.clear(); // 🔥 ОПТИМИЗАЦИЯ: Очищаем dedupe по URL
    this.activePriorities.clear();
    this.pendingResolvers.clear();
    this.queue.queue = [];
    this.queue.activeCount = 0;
    this.processing = false;
    
    // Очистка всех кешей через CacheManager
    await cacheManager.clear();
  }

  /**
   * 🔥 НОВОЕ: Обновление приоритета для уже загружающегося элемента
   * Используется когда элемент входит/выходит из viewport
   * 
   * @param fileId - ID файла
   * @param newPriority - Новый приоритет
   */
  updatePriority(fileId: string, newPriority: LoadPriority): void {
    // 1. Обновляем приоритет в очереди (если элемент еще ждет)
    const queueItem = this.queue.queue.find(item => item.fileId === fileId);
    if (queueItem) {
      const oldPriority = queueItem.priority;
      queueItem.priority = newPriority;
      
      // Пересортировываем очередь по убыванию приоритета
      this.queue.queue.sort((a, b) => b.priority - a.priority);
      
      if (isDev) {
        console.log(`🔄 Priority updated in queue: ${fileId.substring(0, 20)} (${oldPriority} -> ${newPriority})`);
      }
      
      // Пробуем обработать очередь - возможно новый приоритет позволит начать загрузку
      this.processQueue();
    }

    // 2. Обновляем приоритет активной загрузки (если элемент уже грузится)
    if (this.activePriorities.has(fileId)) {
      const oldPriority = this.activePriorities.get(fileId);
      this.activePriorities.set(fileId, newPriority);
      
      if (isDev) {
        console.log(`🔄 Priority updated for active load: ${fileId.substring(0, 20)} (${oldPriority} -> ${newPriority})`);
      }
    }

    // 3. Если элемент уже загружен (в inFlight), обновление не требуется
    // Промис уже создан и вернется при вызове loadResource
  }

  /**
   * 🔥 НОВОЕ: Отмена загрузки элемента (для вытеснения)
   * Пока не реализовано - требует AbortController
   * 
   * @param fileId - ID файла для отмены
   */
  cancelLoad(fileId: string): void {
    // TODO: Реализовать через AbortController
    // Сейчас просто удаляем из очереди
    const index = this.queue.queue.findIndex(item => item.fileId === fileId);
    if (index !== -1) {
      this.queue.queue.splice(index, 1);
      
      if (isDev) {
        console.log(`❌ Load cancelled: ${fileId.substring(0, 20)}`);
      }
    }
  }

  // Получить статистику очереди
  async getQueueStats() {
    const activeByPriority = this.getActiveCountsByPriority();
    const highPriorityQueued = this.queue.queue.filter(item => item.priority >= this.HIGH_PRIORITY_THRESHOLD).length;
    const lowPriorityQueued = this.queue.queue.filter(item => item.priority < this.HIGH_PRIORITY_THRESHOLD).length;
    const cacheStats = await cacheManager.getStats();
    
    return {
      inFlight: this.queue.inFlight.size,
      urlInFlight: this.urlInFlight.size, // 🔥 НОВОЕ: Dedupe по URL
      queued: this.queue.queue.length,
      queuedHigh: highPriorityQueued,
      queuedLow: lowPriorityQueued,
      active: this.queue.activeCount,
      activeHigh: activeByPriority.high,
      activeLow: activeByPriority.low,
      maxConcurrency: this.queue.maxConcurrency,
      reservedHigh: this.HIGH_PRIORITY_MIN_SLOTS,
      reservedLow: this.LOW_PRIORITY_MAX_SLOTS,
      cached: cacheStats
    };
  }
}

// Глобальный экземпляр загрузчика
export const imageLoader = new ImageLoader();

// Экспортируем CacheManager для прямого доступа
export { cacheManager };

// ============================================================================
// 🔥 УТИЛИТНЫЕ ФУНКЦИИ (перенесены из animationLoader.ts)
// ============================================================================

/**
 * Получить закешированный URL видео (синхронно через sync cache)
 */
export const getCachedStickerUrl = (fileId: string): string | undefined => {
  return cacheManager.getSync(fileId, 'video');
};

/**
 * Получить тип медиа (синхронно)
 */
export const getCachedStickerMediaType = (fileId: string): 'image' | 'video' | undefined => {
  const hasVideo = cacheManager.has(fileId, 'video');
  if (hasVideo) {
    return 'video';
  }
  const hasImage = cacheManager.has(fileId, 'image');
  if (hasImage) {
    return 'image';
  }
  return undefined;
};

/**
 * Получить закешированные данные анимации (JSON) - синхронно
 */
export const getCachedAnimation = (fileId: string): any => {
  return cacheManager.getSync(fileId, 'animation');
};

/**
 * @deprecated Используйте imageLoader.loadVideo() или loadImage() напрямую
 * Оставлено для обратной совместимости
 */
export const prefetchSticker = async (
  fileId: string,
  url: string,
  options: { 
    isAnimated?: boolean; 
    isVideo?: boolean; 
    markForGallery?: boolean;
    priority?: LoadPriority;
  } = {}
): Promise<void> => {
  const { 
    isAnimated = false, 
    isVideo = false, 
    priority = LoadPriority.TIER_4_BACKGROUND
  } = options;

  try {
    if (isVideo) {
      await imageLoader.loadVideo(fileId, url, priority);
    } else if (isAnimated) {
      await imageLoader.loadImage(fileId, url, priority);
      await imageLoader.loadAnimation(fileId, url, LoadPriority.TIER_4_BACKGROUND);
    } else {
      await imageLoader.loadImage(fileId, url, priority);
    }
  } catch (error) {
    if (isDev) {
      console.warn(`Failed to prefetch sticker ${fileId}:`, error);
    }
  }
};

/**
 * @deprecated Больше не нужна - no-op
 */
export const markAsGallerySticker = (fileId: string): void => {
  // No-op для обратной совместимости
};

/**
 * @deprecated Используйте imageLoader.clear() напрямую
 */
export const clearNonGalleryAnimations = (): void => {
  if (isDev) {
    console.warn('clearNonGalleryAnimations is deprecated. Use imageLoader.clear() if needed.');
  }
};

/**
 * @deprecated Используйте imageLoader.clear() напрямую  
 */
export const clearStickerBlobsExcept = (preserveIds: Set<string>): void => {
  if (isDev) {
    console.warn('clearStickerBlobsExcept is deprecated. Use imageLoader.clear() if needed.');
  }
};

// 🔥 НОВОЕ: Экспортируем синхронные кеши для совместимости
export const animationCache = {
  get: (fileId: string) => cacheManager.getSync(fileId, 'animation'),
  has: (fileId: string) => cacheManager.has(fileId, 'animation'),
  set: async (fileId: string, data: any) => await cacheManager.set(fileId, data, 'animation'),
  delete: async (fileId: string) => await cacheManager.delete(fileId, 'animation'),
  clear: async () => await cacheManager.clear('animation'),
  keys: () => {
    // Для диагностики: возвращаем ключи из syncCache
    const syncCache = (cacheManager as any).syncCache?.animations;
    return syncCache ? syncCache.keys() : [][Symbol.iterator]();
  }
};

export const videoBlobCache = {
  get: (fileId: string) => cacheManager.getSync(fileId, 'video'),
  has: (fileId: string) => cacheManager.has(fileId, 'video'),
  set: async (fileId: string, data: string) => await cacheManager.set(fileId, data, 'video'),
  delete: async (fileId: string) => await cacheManager.delete(fileId, 'video'),
  clear: async () => await cacheManager.clear('video'),
  keys: () => {
    // Для диагностики: возвращаем ключи из syncCache
    const syncCache = (cacheManager as any).syncCache?.videos;
    return syncCache ? syncCache.keys() : [][Symbol.iterator]();
  }
};

// Для обратной совместимости с imageCache
export const imageCache = {
  get: (fileId: string) => cacheManager.getSync(fileId, 'image'),
  has: (fileId: string) => cacheManager.has(fileId, 'image'),
  set: async (fileId: string, url: string) => await cacheManager.set(fileId, url, 'image'),
  delete: async (fileId: string) => await cacheManager.delete(fileId, 'image'),
  clear: async () => await cacheManager.clear('image'),
  keys: () => {
    // Для диагностики: возвращаем ключи из syncCache
    const syncCache = (cacheManager as any).syncCache?.images;
    return syncCache ? syncCache.keys() : [][Symbol.iterator]();
  }
};

// 🔍 ДИАГНОСТИКА: Экспортируем imageLoader в window для тестов
if (typeof window !== 'undefined') {
  (window as any).imageLoader = {
    imageCache,
    animationCache,
    videoBlobCache,
    cacheManager,
    loader: imageLoader
  };
}
