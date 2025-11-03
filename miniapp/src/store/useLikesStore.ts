import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api/client';

interface LikeState {
  packId: string;
  isLiked: boolean;
  likesCount: number;
  syncing?: boolean;  // Флаг синхронизации с сервером
  error?: string;     // Ошибка синхронизации
}

interface PendingLike {
  packId: string;
  isLiked: boolean;
  timestamp: number;
  retries: number;
}

interface LikesStore {
  likes: Record<string, LikeState>;
  pendingSync: PendingLike[];  // Очередь для offline синхронизации
  lastSyncTime: Record<string, number>;  // Последнее время синхронизации для rate limiting
  toggleLike: (packId: string) => Promise<void>;
  setLike: (packId: string, isLiked: boolean, likesCount?: number) => void;
  initializeLikes: (stickerSets: Array<{ id: number; likes?: number }>, mergeMode?: boolean) => void;
  getLikeState: (packId: string) => LikeState;
  isLiked: (packId: string) => boolean;
  getLikesCount: (packId: string) => number;
  syncPendingLikes: () => Promise<void>;
  clearStorage: () => void;
}

// Версия storage - при изменении будут очищены старые данные
const STORAGE_VERSION = 3;

// Константы для защиты от DDOS
const MIN_REQUEST_INTERVAL = 1000; // Минимум 1 секунда между запросами на один стикер
const MAX_RETRIES = 3; // Максимум попыток повтора при ошибке
const DEBOUNCE_DELAY = 500; // Задержка debounce перед отправкой на сервер

// Таймеры debounce для каждого стикерсета
const debounceTimers: Record<string, NodeJS.Timeout> = {};

export const useLikesStore = create<LikesStore>()(
  persist(
    (set, get) => ({
      likes: {},
      pendingSync: [],
      lastSyncTime: {},

      toggleLike: async (packId: string) => {
        const currentState = get().likes[packId];
        const newIsLiked = !currentState?.isLiked;
        const newLikesCount = (currentState?.likesCount || 0) + (newIsLiked ? 1 : -1);
        const now = Date.now();
        const lastSync = get().lastSyncTime[packId] || 0;

        // ЗАЩИТА ОТ DDOS: Rate limiting - проверяем минимальный интервал
        if (now - lastSync < MIN_REQUEST_INTERVAL) {
          console.warn(`⚠️ Rate limit: слишком частые запросы для ${packId}. Подождите ${MIN_REQUEST_INTERVAL}ms`);
          // Обновляем UI оптимистично, но не синхронизируем с сервером
          set((state) => ({
            likes: {
              ...state.likes,
              [packId]: {
                packId,
                isLiked: newIsLiked,
                likesCount: Math.max(0, newLikesCount),
                syncing: false,
                error: 'Слишком частые запросы. Подождите немного.'
              }
            }
          }));
          return;
        }

        // OPTIMISTIC UPDATE: Обновляем UI мгновенно
        set((state) => ({
          likes: {
            ...state.likes,
            [packId]: {
              packId,
              isLiked: newIsLiked,
              likesCount: Math.max(0, newLikesCount),
              syncing: true,
              error: undefined
            }
          },
          lastSyncTime: {
            ...state.lastSyncTime,
            [packId]: now
          }
        }));

        // DEBOUNCE: Очищаем предыдущий таймер и создаем новый
        if (debounceTimers[packId]) {
          clearTimeout(debounceTimers[packId]);
        }

        debounceTimers[packId] = setTimeout(async () => {
          try {
            // Синхронизация с сервером (PUT /toggle автоматически определяет действие)
            const response = await apiClient.toggleLike(parseInt(packId));

            // Бывают случаи (dev, прокси, неустановленные заголовки), когда сервер
            // возвращает неверный isLiked (false) при корректном обновлении счётчика.
            // Чтобы не мигало сердце, в течение короткого окна доверяем локальному
            // состоянию newIsLiked, если оно расходится с ответом.
            const serverIsLiked = response.isLiked;
            const finalIsLiked = serverIsLiked === newIsLiked ? serverIsLiked : newIsLiked;
            if (serverIsLiked !== newIsLiked) {
              console.warn(`⚠️ Сервер вернул isLiked=${serverIsLiked} для ${packId}, ожидаем ${newIsLiked}. Сохраняем локальное значение для UX.`);
            }

            set((state) => ({
              likes: {
                ...state.likes,
                [packId]: {
                  packId,
                  isLiked: finalIsLiked,
                  likesCount: Math.max(0, response.totalLikes),
                  syncing: false,
                  error: undefined
                }
              }
            }));

            console.log(`✅ Лайк синхронизирован с сервером для ${packId}:`, response);
          } catch (error) {
            console.error(`❌ Ошибка синхронизации лайка для ${packId}:`, error);

            // ROLLBACK: Откатываем изменения при ошибке
            const oldIsLiked = !newIsLiked;
            const oldLikesCount = (currentState?.likesCount || 0);

            set((state) => ({
              likes: {
                ...state.likes,
                [packId]: {
                  packId,
                  isLiked: oldIsLiked,
                  likesCount: oldLikesCount,
                  syncing: false,
                  error: error instanceof Error ? error.message : 'Ошибка синхронизации'
                }
              },
              // Добавляем в очередь для повторной попытки
              pendingSync: [
                ...state.pendingSync,
                {
                  packId,
                  isLiked: newIsLiked,
                  timestamp: Date.now(),
                  retries: 0
                }
              ]
            }));
          }
        }, DEBOUNCE_DELAY);
      },

      setLike: (packId: string, isLiked: boolean, likesCount?: number) => {
        set((state) => ({
          likes: {
            ...state.likes,
            [packId]: {
              packId,
              isLiked,
              likesCount: likesCount ?? (state.likes[packId]?.likesCount || 0)
            }
          }
        }));
      },

      initializeLikes: (stickerSets: Array<{ 
        id: number; 
        // API возвращает разные названия в разных endpoints
        likes?: number;              // Старое название
        likesCount?: number;         // Новое название (GET /stickersets)
        isLiked?: boolean;           // Старое название
        isLikedByCurrentUser?: boolean;  // Новое название (GET /stickersets)
      }>, mergeMode: boolean = false) => {
        console.log('🔍 DEBUG initializeLikes: Получено стикерсетов:', stickerSets.length, 'mergeMode:', mergeMode);
        
        set((state) => {
          const updates = new Map<string, LikeState>();
          const now = Date.now();
          
          stickerSets.forEach(stickerSet => {
            const apiLikesCount = stickerSet.likesCount ?? stickerSet.likes ?? 0;
            const packId = stickerSet.id.toString();
            const existingState = state.likes[packId];
            const apiIsLiked = stickerSet.isLikedByCurrentUser ?? stickerSet.isLiked;
            
            // Защита от перезаписи свежих данных старыми из кэша:
            // 1. Синхронизация идет - сохраняем локальное
            // 2. Недавнее изменение (< 10 сек) и API отличается - игнорируем API
            // 3. Существующая запись старше 10 сек - обновляем из API
            // 4. Новая запись - создаем из API
            
            const lastSync = state.lastSyncTime[packId] || 0;
            const timeSinceSync = now - lastSync;
            const isRecentChange = timeSinceSync < 10000; // 10 секунд защиты от кэша
            
            let isLiked: boolean;
            let likesCount: number;
            
            if (existingState?.syncing) {
              // Идет синхронизация - сохраняем локальное состояние
              isLiked = existingState.isLiked;
              likesCount = existingState.likesCount;
            } else if (mergeMode && existingState && isRecentChange && apiIsLiked !== undefined && apiIsLiked !== existingState.isLiked) {
              // Режим слияния + недавнее изменение + конфликт - сохраняем локальное
              isLiked = existingState.isLiked;
              likesCount = existingState.likesCount;
            } else if (apiIsLiked !== undefined) {
              // API вернул данные - используем их
              isLiked = apiIsLiked;
              likesCount = apiLikesCount;
            } else if (existingState) {
              // API не вернул данные - сохраняем существующие
              isLiked = existingState.isLiked;
              likesCount = existingState.likesCount;
            } else {
              // Новая запись
              isLiked = false;
              likesCount = apiLikesCount;
            }
            
            updates.set(packId, {
              packId,
              isLiked,
              likesCount,
              syncing: existingState?.syncing,
              error: existingState?.error
            });
          });
          
          if (updates.size === 0) return state;
          
          // В режиме слияния сохраняем все существующие + обновляем новые
          // Иначе заменяем только те, что в updates
          const newLikes = mergeMode 
            ? { ...state.likes, ...Object.fromEntries(updates) }
            : { ...state.likes, ...Object.fromEntries(updates) };
          
          return { likes: newLikes };
        });
      },

      getLikeState: (packId: string) => {
        return get().likes[packId] || {
          packId,
          isLiked: false,
          likesCount: 0
        };
      },

      isLiked: (packId: string) => {
        return get().likes[packId]?.isLiked || false;
      },

      getLikesCount: (packId: string) => {
        return get().likes[packId]?.likesCount || 0;
      },

      // Синхронизация отложенных лайков (для offline режима)
      syncPendingLikes: async () => {
        const { pendingSync } = get();
        
        if (pendingSync.length === 0) {
          console.log('✅ Нет отложенных лайков для синхронизации');
          return;
        }

        console.log(`🔄 Синхронизация ${pendingSync.length} отложенных лайков...`);

        // Обрабатываем по одному, чтобы не перегрузить сервер
        for (const pending of pendingSync) {
          const { packId, isLiked, retries } = pending;

          // Пропускаем если превышено количество попыток
          if (retries >= MAX_RETRIES) {
            console.warn(`⚠️ Превышено количество попыток для ${packId}. Пропускаем.`);
            continue;
          }

          try {
            // PUT /toggle автоматически переключает состояние на сервере
            const response = await apiClient.toggleLike(parseInt(packId));

            // Обновляем с РЕАЛЬНЫМИ данными от сервера
            set((state) => ({
              likes: {
                ...state.likes,
                [packId]: {
                  packId,
                  isLiked: response.isLiked,        // От сервера
                  likesCount: response.totalLikes,  // От сервера
                  syncing: false,
                  error: undefined
                }
              },
              // Удаляем из очереди после успешной синхронизации
              pendingSync: state.pendingSync.filter(p => p.packId !== packId)
            }));

            console.log(`✅ Отложенный лайк синхронизирован для ${packId}`);
          } catch (error) {
            console.error(`❌ Ошибка синхронизации отложенного лайка для ${packId}:`, error);

            // Увеличиваем счетчик попыток
            set((state) => ({
              pendingSync: state.pendingSync.map(p =>
                p.packId === packId
                  ? { ...p, retries: p.retries + 1 }
                  : p
              )
            }));
          }

          // Задержка между запросами для защиты от DDOS
          await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL));
        }

        console.log('✅ Синхронизация отложенных лайков завершена');
      },

      clearStorage: () => {
        // Очищаем все данные о лайках
        set({ 
          likes: {},
          pendingSync: [],
          lastSyncTime: {}
        });
        
        // Очищаем debounce таймеры
        Object.values(debounceTimers).forEach(timer => clearTimeout(timer));
      }
    }),
    {
      name: 'likes-storage',
      version: STORAGE_VERSION,
      partialize: (state) => ({
        likes: state.likes,
        pendingSync: state.pendingSync,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
);



