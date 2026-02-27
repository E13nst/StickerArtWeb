/**
 * Вспомогательные функции для useLikesStore
 * Упрощает основной store файл и делает логику переиспользуемой
 */

import { apiClient } from '../api/client';

// Типы
export interface LikeState {
  packId: string;
  isLiked: boolean;
  likesCount: number;
  syncing?: boolean;
  error?: string;
}

export interface PendingLike {
  packId: string;
  isLiked: boolean;
  timestamp: number;
  retries: number;
}

// Константы
export const MIN_REQUEST_INTERVAL = 1000;
export const MAX_RETRIES = 3;
export const DEBOUNCE_DELAY = 500;
export const RECENT_CHANGE_WINDOW = 10000; // 10 секунд

// Таймеры debounce
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Проверяет rate limit для packId
 */
export function checkRateLimit(packId: string, lastSyncTime: Record<string, number>): boolean {
  const now = Date.now();
  const lastSync = lastSyncTime[packId] || 0;
  return now - lastSync < MIN_REQUEST_INTERVAL;
}

/**
 * Создает новое состояние для optimistic update
 */
export function createOptimisticState(
  packId: string,
  currentState: LikeState | undefined,
  newIsLiked: boolean
): LikeState {
  const currentCount = currentState?.likesCount || 0;
  const newLikesCount = currentCount + (newIsLiked ? 1 : -1);

  return {
    packId,
    isLiked: newIsLiked,
    likesCount: Math.max(0, newLikesCount),
    syncing: true,
    error: undefined
  };
}

/**
 * Создает состояние при ошибке rate limit
 */
export function createRateLimitErrorState(
  packId: string,
  newIsLiked: boolean,
  newLikesCount: number
): LikeState {
  return {
    packId,
    isLiked: newIsLiked,
    likesCount: Math.max(0, newLikesCount),
    syncing: false,
    error: 'Слишком частые запросы. Подождите немного.'
  };
}

/**
 * Синхронизирует лайк с сервером (с debounce)
 */
export function syncLikeWithServer(
  packId: string,
  newIsLiked: boolean,
  currentState: LikeState | undefined,
  onSuccess: (isLiked: boolean, likesCount: number) => void,
  onError: (error: Error, oldIsLiked: boolean, oldLikesCount: number) => void
): void {
  // Очищаем предыдущий таймер
  if (debounceTimers[packId]) {
    clearTimeout(debounceTimers[packId]);
  }

  // Создаем новый debounced запрос
  debounceTimers[packId] = setTimeout(async () => {
    try {
      const response = await apiClient.toggleLike(parseInt(packId));
      // Всегда берём состояние с сервера — один источник правды для дашборда и модалки
      const finalIsLiked = response.isLiked;
      const totalLikes = Math.max(0, response.totalLikes);
      onSuccess(finalIsLiked, totalLikes);
    } catch (error) {
      console.error(`❌ Ошибка синхронизации лайка для ${packId}:`, error);

      // Откатываем к предыдущему состоянию
      const oldIsLiked = !newIsLiked;
      const oldLikesCount = currentState?.likesCount || 0;

      onError(
        error instanceof Error ? error : new Error('Unknown error'),
        oldIsLiked,
        oldLikesCount
      );
    }
  }, DEBOUNCE_DELAY);
}

/**
 * Очищает debounce таймер для packId
 */
export function clearDebounceTimer(packId: string): void {
  if (debounceTimers[packId]) {
    clearTimeout(debounceTimers[packId]);
    delete debounceTimers[packId];
  }
}

/**
 * Очищает все debounce таймеры
 */
export function clearAllDebounceTimers(): void {
  Object.values(debounceTimers).forEach(timer => clearTimeout(timer));
  Object.keys(debounceTimers).forEach(key => delete debounceTimers[key]);
}

/**
 * Определяет финальное состояние лайка при инициализации
 * Учитывает синхронизацию, недавние изменения, конфликты с API
 */
export function resolveLikeState(params: {
  existingState: LikeState | undefined;
  apiIsLiked: boolean | undefined;
  apiLikesCount: number;
  lastSyncTime: number;
  now: number;
  mergeMode: boolean;
}): { isLiked: boolean; likesCount: number } {
  const { existingState, apiIsLiked, apiLikesCount, lastSyncTime, now, mergeMode } = params;
  
  const timeSinceSync = now - lastSyncTime;
  const isRecentChange = timeSinceSync < RECENT_CHANGE_WINDOW;

  // Приоритет 1: Идет синхронизация - сохраняем локальное
  if (existingState?.syncing) {
    return {
      isLiked: existingState.isLiked,
      likesCount: existingState.likesCount
    };
  }

  // Приоритет 2: Режим слияния + недавнее изменение + конфликт - сохраняем локальное
  if (
    mergeMode &&
    existingState &&
    isRecentChange &&
    apiIsLiked !== undefined &&
    apiIsLiked !== existingState.isLiked
  ) {
    return {
      isLiked: existingState.isLiked,
      likesCount: existingState.likesCount
    };
  }

  // Приоритет 3: API вернул данные - используем их
  if (apiIsLiked !== undefined) {
    return {
      isLiked: apiIsLiked,
      likesCount: apiLikesCount
    };
  }

  // Приоритет 4: API не вернул данные - сохраняем существующие
  if (existingState) {
    return {
      isLiked: existingState.isLiked,
      likesCount: existingState.likesCount
    };
  }

  // Приоритет 5: Новая запись без данных
  return {
    isLiked: false,
    likesCount: apiLikesCount
  };
}

/**
 * Логирует изменения состояния (только при наличии изменений)
 */
export function logStateChange(
  _packId: string,
  _action: 'optimistic' | 'sync' | 'setLike' | 'init',
  oldState: LikeState | undefined,
  newState: { isLiked: boolean; likesCount: number },
  _additionalData?: any
): void {
  // Проверяем, изменилось ли состояние
  const hasChanged =
    !oldState ||
    oldState.isLiked !== newState.isLiked ||
    oldState.likesCount !== newState.likesCount;

  if (!hasChanged) return;
  // Логирование отключено для уменьшения шума; при отладке можно вернуть console.log
}

