// Service Worker для Sticker Art Gallery
// Версия: 1.0.0

const CACHE_VERSION = 'sticker-gallery-v1';
const RUNTIME_CACHE = 'runtime-cache-v1';
const IMAGE_CACHE = 'image-cache-v1';

// Файлы для предварительного кэширования при установке SW
const PRECACHE_URLS = [
  '/miniapp/',
  '/miniapp/index.html',
];

// Установка SW и предварительное кэширование
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Активация SW и очистка старых кэшей
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Удаляем старые версии кэшей
            if (cacheName !== CACHE_VERSION && 
                cacheName !== RUNTIME_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Обработка fetch запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Пропускаем не-GET запросы
  if (request.method !== 'GET') {
    return;
  }
  
  // Пропускаем chrome-extension и другие протоколы
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Стратегия 1: Static Assets (JS, CSS, fonts) - Cache First
  if (url.pathname.startsWith('/miniapp/assets/') || 
      url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then((response) => {
            // Кэшируем только успешные ответы
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_VERSION)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
            }
            return response;
          });
        })
    );
    return;
  }

  // Стратегия 2: Images/Stickers - Cache First с fallback
  if (url.pathname.startsWith('/stickers/') || 
      url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(IMAGE_CACHE)
                  .then((cache) => {
                    cache.put(request, responseToCache);
                  });
              }
              return response;
            })
            .catch(() => {
              // Fallback для offline режима
              console.log('[SW] Image failed to load, offline mode');
            });
        })
    );
    return;
  }

  // Стратегия 3: API запросы - Network First, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Кэшируем только GET запросы с успешными ответами
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // При ошибке сети пытаемся вернуть из кэша
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Serving API from cache (offline):', url.pathname);
                return cachedResponse;
              }
              
              // Если в кэше тоже нет - возвращаем ошибку
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'No internet connection and no cached data' 
                }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Стратегия 4: HTML страницы - Network First
  if (request.mode === 'navigate' || 
      url.pathname.endsWith('.html') || 
      url.pathname === '/miniapp/' ||
      url.pathname.startsWith('/miniapp/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // При offline возвращаем закэшированную главную страницу
          return caches.match('/miniapp/index.html');
        })
    );
    return;
  }

  // По умолчанию - Network First
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        })
    );
  }
});

console.log('[SW] Service Worker loaded');

