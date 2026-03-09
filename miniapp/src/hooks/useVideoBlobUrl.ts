import { useSyncExternalStore } from 'react';
import { videoBlobCache } from '../utils/imageLoader';

const noop = () => () => {};

/**
 * Реактивный хук для получения blob URL видео-стикера.
 *
 * Использует useSyncExternalStore (React 18) — официальный паттерн для подписки
 * на внешние хранилища. Компонент автоматически перерисовывается, когда
 * imageLoader записывает blob URL в videoBlobCache для данного fileId.
 *
 * Это решает проблему "PackCard не видит blob, который появился после первого рендера":
 * вместо синхронного чтения при рендере — реактивная подписка.
 */
export function useVideoBlobUrl(fileId: string | null | undefined): string | null {
  return useSyncExternalStore(
    // subscribe: вызывается React при монтировании/изменении fileId
    (callback) => {
      if (!fileId) return noop();
      return videoBlobCache.subscribe(fileId, callback);
    },
    // getSnapshot: синхронно возвращает текущее значение из syncCache
    () => (fileId ? (videoBlobCache.get(fileId) ?? null) : null),
    // getServerSnapshot: для SSR/hydration — всегда null (TMA не SSR)
    () => null
  );
}
