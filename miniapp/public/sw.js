// Service Worker для кеширования стикеров (с таймаутами и retry)
const CACHE_NAME = 'stixly-stickers-v4';
const STICKER_CACHE_NAME = 'stixly-stickers-media-v4';

// Таймауты для разных типов ресурсов
const TIMEOUTS = {
  stickers: 15000, // 15 секунд для стикеров (могут быть большими файлами)
  api: 10000       // 10 секунд для API
};

// Стратегия кеширования для разных типов ресурсов
const CACHE_STRATEGIES = {
  // Стикеры - агрессивное кеширование
  stickers: {
    match: /\/stickers\//,
    strategy: 'CacheFirst',
    cacheName: STICKER_CACHE_NAME,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    maxEntries: 500,
    timeout: TIMEOUTS.stickers
  },
  // API запросы - Network First с fallback на кеш
  api: {
    match: /\/api\//,
    strategy: 'NetworkFirst',
    cacheName: CACHE_NAME,
    maxAge: 5 * 60 * 1000, // 5 минут
    maxEntries: 100,
    timeout: TIMEOUTS.api
  }
};

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  // Пропускаем ожидание и активируем сразу
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    // Удаляем старые кеши
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STICKER_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Берем контроль над всеми клиентами
      return self.clients.claim();
    })
  );
});

// Перехват fetch запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Игнорируем не-GET запросы
  if (request.method !== 'GET') {
    return;
  }

  // Игнорируем запросы к другим доменам (кроме стикеров)
  if (url.origin !== self.location.origin && !url.pathname.includes('/stickers/')) {
    return;
  }

  // Определяем стратегию кеширования
  let strategy = null;
  let config = null;

  for (const [key, cfg] of Object.entries(CACHE_STRATEGIES)) {
    if (cfg.match.test(url.pathname)) {
      strategy = cfg.strategy;
      config = cfg;
      break;
    }
  }

  // Если нет стратегии - пропускаем
  if (!strategy) {
    return;
  }

  // Применяем стратегию кеширования
  if (strategy === 'CacheFirst') {
    event.respondWith(cacheFirst(request, config));
  } else if (strategy === 'NetworkFirst') {
    event.respondWith(networkFirst(request, config));
  }
});

/**
 * Fetch с таймаутом
 * @param {Request} request - запрос
 * @param {number} timeout - таймаут в миллисекундах
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(request, timeout = 10000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
    )
  ]);
}

/**
 * Fetch с retry логикой и экспоненциальной задержкой
 * @param {Request} request - запрос
 * @param {number} retries - количество повторных попыток
 * @param {number} timeout - таймаут для каждой попытки
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(request, retries = 2, timeout = 10000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(request, timeout);
      
      // Если 504 или 503 - пробуем retry (но не на последней попытке)
      if (i < retries && (response.status === 504 || response.status === 503)) {
        console.log(`[SW] Got ${response.status}, retry ${i + 1}/${retries}:`, request.url.substring(request.url.length - 50));
        // Экспоненциальная задержка: 1s, 2s, 4s... (максимум 5s)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 5000)));
        continue;
      }
      
      return response;
    } catch (error) {
      console.error(`[SW] Fetch attempt ${i + 1}/${retries + 1} failed:`, error.message);
      
      if (i === retries) {
        throw error; // Последняя попытка - бросаем ошибку
      }
      
      // Ждем перед retry (экспоненциальная задержка)
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 5000)));
    }
  }
}

/**
 * Cache First стратегия: сначала проверяем кеш, потом сеть
 * Идеально для статических ресурсов (стикеры, изображения)
 */
async function cacheFirst(request, config) {
  const cache = await caches.open(config.cacheName);
  
  // Проверяем кеш
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Проверяем возраст кеша
    const cachedTime = parseInt(cachedResponse.headers.get('sw-cached-time') || '0');
    const now = Date.now();
    
    if (now - cachedTime < config.maxAge) {
      console.log('[SW] Cache HIT:', request.url.substring(request.url.length - 50));
      return cachedResponse;
    } else {
      console.log('[SW] Cache EXPIRED:', request.url.substring(request.url.length - 50));
      // Кеш устарел - удаляем
      await cache.delete(request);
    }
  }

  // Кеша нет или устарел - загружаем из сети с retry и таймаутом
  try {
    console.log('[SW] Cache MISS, fetching with timeout:', request.url.substring(request.url.length - 50));
    
    // Используем timeout из конфигурации с retry (2 попытки)
    const timeout = config.timeout || TIMEOUTS.stickers;
    const networkResponse = await fetchWithRetry(request, 2, timeout);
    
    // Кешируем только успешные ответы
    if (networkResponse && networkResponse.status === 200) {
      // Клонируем ответ (можно использовать только раз)
      const responseToCache = networkResponse.clone();
      
      // Добавляем метку времени кеширования
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-time', Date.now().toString());
      
      const responseWithTime = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      // Сохраняем в кеш асинхронно
      cache.put(request, responseWithTime);
      
      // Управление размером кеша
      manageCacheSize(config.cacheName, config.maxEntries);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] All fetch attempts failed:', error);
    
    // Если сеть недоступна - возвращаем кеш даже если устарел
    if (cachedResponse) {
      console.log('[SW] Returning stale cache due to network error');
      return cachedResponse;
    }
    
    // Возвращаем понятную ошибку с деталями
    return new Response(
      JSON.stringify({ 
        error: 'Failed to load resource', 
        message: error.message,
        url: request.url.substring(request.url.length - 100)
      }), 
      {
        status: 504,
        statusText: 'Gateway Timeout (Service Worker)',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Network First стратегия: сначала пробуем сеть, fallback на кеш
 * Идеально для API запросов
 */
async function networkFirst(request, config) {
  const cache = await caches.open(config.cacheName);
  
  try {
    // Пробуем загрузить из сети с таймаутом и retry
    const timeout = config.timeout || TIMEOUTS.api;
    const networkResponse = await fetchWithRetry(request, 1, timeout); // Для API - только 1 retry
    
    if (networkResponse && networkResponse.status === 200) {
      // Кешируем ответ
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-time', Date.now().toString());
      
      const responseWithTime = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(request, responseWithTime);
      manageCacheSize(config.cacheName, config.maxEntries);
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network failed, trying cache:', error);
    
    // Сеть недоступна - пробуем кеш
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache (network failed)');
      return cachedResponse;
    }
    
    // Ни сети, ни кеша - возвращаем понятную ошибку
    return new Response(
      JSON.stringify({ 
        error: 'Network error and no cache', 
        message: error.message 
      }), 
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Управление размером кеша (LRU eviction)
 */
async function manageCacheSize(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxEntries) {
    // Удаляем самые старые записи
    const entriesToDelete = keys.length - maxEntries;
    
    // Сортируем по времени кеширования
    const sortedKeys = await Promise.all(
      keys.map(async (request) => {
        const response = await cache.match(request);
        const cachedTime = parseInt(response?.headers.get('sw-cached-time') || '0');
        return { request, cachedTime };
      })
    );
    
    sortedKeys.sort((a, b) => a.cachedTime - b.cachedTime);
    
    // Удаляем самые старые
    for (let i = 0; i < entriesToDelete; i++) {
      console.log('[SW] Evicting old cache entry:', sortedKeys[i].request.url);
      await cache.delete(sortedKeys[i].request);
    }
  }
}

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
      })
    );
  }
});
