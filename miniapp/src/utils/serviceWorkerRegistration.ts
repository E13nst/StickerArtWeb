/**
 * Регистрация Service Worker для кеширования HTTP запросов
 */

const isDev = (import.meta as any).env?.DEV;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Service Worker работает только в production и через HTTPS (или localhost)
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker не поддерживается браузером');
    return null;
  }

  try {
    // Регистрируем Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    if (isDev) {
      console.log('[SW] Service Worker зарегистрирован:', registration);
    }

    // Обработка обновлений Service Worker
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Новая версия Service Worker установлена
            console.log('[SW] Новая версия Service Worker готова к активации');
            
            // Можно показать уведомление пользователю
            // или автоматически активировать (отправив SKIP_WAITING)
            if (isDev) {
              // В dev режиме автоматически активируем новую версию
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[SW] Ошибка регистрации Service Worker:', error);
    return null;
  }
}

/**
 * Отменить регистрацию Service Worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      console.log('[SW] Service Worker отменен');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[SW] Ошибка отмены Service Worker:', error);
    return false;
  }
}

/**
 * Очистить все кеши Service Worker
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.active) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
      console.log('[SW] Команда очистки кеша отправлена');
    }

    // Также очищаем через Cache API напрямую
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[SW] Все кеши очищены');
  } catch (error) {
    console.error('[SW] Ошибка очистки кешей:', error);
  }
}

/**
 * Проверить статус Service Worker
 */
export function getServiceWorkerStatus(): {
  supported: boolean;
  registered: boolean;
  controller: boolean;
} {
  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      registered: false,
      controller: false
    };
  }

  return {
    supported: true,
    registered: !!navigator.serviceWorker.controller,
    controller: !!navigator.serviceWorker.controller
  };
}

