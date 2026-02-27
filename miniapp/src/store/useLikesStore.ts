import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api/client';
import {
  LikeState,
  PendingLike,
  MIN_REQUEST_INTERVAL,
  MAX_RETRIES,
  checkRateLimit,
  createOptimisticState,
  createRateLimitErrorState,
  syncLikeWithServer,
  clearAllDebounceTimers,
  resolveLikeState,
  logStateChange
} from './likesStoreHelpers';

interface LikesStore {
  likes: Record<string, LikeState>;
  pendingSync: PendingLike[];
  lastSyncTime: Record<string, number>;
  toggleLike: (packId: string) => Promise<void>;
  setLike: (packId: string, isLiked: boolean, likesCount?: number) => void;
  initializeLikes: (stickerSets: Array<{ id: number; likes?: number }>, mergeMode?: boolean) => void;
  getLikeState: (packId: string) => LikeState;
  isLiked: (packId: string) => boolean;
  getLikesCount: (packId: string) => number;
  syncPendingLikes: () => Promise<void>;
  resetPendingSync: () => void;
  clearStorage: () => void;
}

// Версия storage - при изменении будут очищены старые данные
const STORAGE_VERSION = 3;

export const useLikesStore = create<LikesStore>()(
  persist(
    (set, get) => ({
      likes: {},
      pendingSync: [],
      lastSyncTime: {},

      // ✅ REFACTORED: Упрощенная версия toggleLike с использованием helpers
      toggleLike: async (packId: string) => {
        const currentState = get().likes[packId];
        const newIsLiked = !currentState?.isLiked;
        const now = Date.now();

        // Проверка rate limit
        if (checkRateLimit(packId, get().lastSyncTime)) {
          console.warn(`⚠️ Rate limit: слишком частые запросы для ${packId}`);
          
          const newLikesCount = (currentState?.likesCount || 0) + (newIsLiked ? 1 : -1);
          const errorState = createRateLimitErrorState(packId, newIsLiked, newLikesCount);
          
          set((state) => ({
            likes: { ...state.likes, [packId]: errorState }
          }));
          return;
        }

        // Optimistic update
        const optimisticState = createOptimisticState(packId, currentState, newIsLiked);
        
        set((state) => {
          logStateChange(packId, 'optimistic', state.likes[packId], optimisticState);
          
          return {
            likes: { ...state.likes, [packId]: optimisticState },
            lastSyncTime: { ...state.lastSyncTime, [packId]: now }
          };
        });

        // Debounced server sync
        syncLikeWithServer(
          packId,
          newIsLiked,
          currentState,
          // onSuccess
          (finalIsLiked, likesCount) => {
            set((state) => {
              const syncedState: LikeState = {
                packId,
                isLiked: finalIsLiked,
                likesCount,
                syncing: false,
                error: undefined
              };

              logStateChange(packId, 'sync', state.likes[packId], syncedState);

              return {
                likes: { ...state.likes, [packId]: syncedState }
              };
            });
          },
          // onError
          (error, oldIsLiked, oldLikesCount) => {
            set((state) => ({
              likes: {
                ...state.likes,
                [packId]: {
                  packId,
                  isLiked: oldIsLiked,
                  likesCount: oldLikesCount,
                  syncing: false,
                  error: error.message
                }
              },
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
        );
      },

      // ✅ REFACTORED: Упрощенный setLike
      setLike: (packId: string, isLiked: boolean, likesCount?: number) => {
        set((state) => {
          const oldState = state.likes[packId];
          const newLikesCount = likesCount ?? (oldState?.likesCount || 0);
          const newState: LikeState = {
            packId,
            isLiked,
            likesCount: newLikesCount
          };

          logStateChange(packId, 'setLike', oldState, newState);

          return {
            likes: { ...state.likes, [packId]: newState }
          };
        });
      },

      // ✅ REFACTORED: Упрощенный initializeLikes с использованием resolveLikeState
      initializeLikes: (stickerSets: Array<{ 
        id: number; 
        likes?: number;
        likesCount?: number;
        isLiked?: boolean;
        isLikedByCurrentUser?: boolean;
      }>, mergeMode: boolean = false) => {
        set((state) => {
          const updates = new Map<string, LikeState>();
          const now = Date.now();
          
          stickerSets.forEach(stickerSet => {
            const packId = stickerSet.id.toString();
            const existingState = state.likes[packId];
            const apiLikesCount = stickerSet.likesCount ?? stickerSet.likes ?? 0;
            const apiIsLiked = stickerSet.isLikedByCurrentUser ?? stickerSet.isLiked;
            const lastSync = state.lastSyncTime[packId] || 0;

            // Используем helper для определения финального состояния
            const { isLiked, likesCount } = resolveLikeState({
              existingState,
              apiIsLiked,
              apiLikesCount,
              lastSyncTime: lastSync,
              now,
              mergeMode
            });
            
            updates.set(packId, {
              packId,
              isLiked,
              likesCount,
              syncing: existingState?.syncing,
              error: existingState?.error
            });
          });
          
          if (updates.size === 0) return state;
          
          return { likes: { ...state.likes, ...Object.fromEntries(updates) } };
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

          const currentState = get().likes[packId];

          // Если текущее состояние уже соответствует желаемому, просто очищаем очередь
          if (currentState?.isLiked === isLiked) {
            set((state) => ({
              likes: {
                ...state.likes,
                [packId]: {
                  packId,
                  isLiked: state.likes[packId]?.isLiked ?? false,
                  likesCount: state.likes[packId]?.likesCount ?? 0,
                  syncing: false,
                  error: undefined
                }
              },
              pendingSync: state.pendingSync.filter((p) => p.packId !== packId)
            }));
            continue;
          }

          try {
            const response = isLiked
              ? await apiClient.likeStickerSet(parseInt(packId))
              : await apiClient.unlikeStickerSet(parseInt(packId));

            const finalIsLiked = response.isLiked ?? isLiked;

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
              },
              pendingSync: state.pendingSync.filter((p) => p.packId !== packId),
              lastSyncTime: {
                ...state.lastSyncTime,
                [packId]: Date.now()
              }
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
              ),
              likes: {
                ...state.likes,
                [packId]: {
                  packId,
                  isLiked: state.likes[packId]?.isLiked ?? false,
                  likesCount: state.likes[packId]?.likesCount ?? 0,
                  syncing: false,
                  error: error instanceof Error ? error.message : 'Ошибка синхронизации'
                }
              }
            }));
          }

          // Задержка между запросами для защиты от DDOS
          await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL));
        }

        console.log('✅ Синхронизация отложенных лайков завершена');
      },

      resetPendingSync: () => {
        set((state) => {
          const sanitizedLikes = Object.fromEntries(
            Object.entries(state.likes).map(([id, likeState]) => [
              id,
              {
                ...likeState,
                syncing: false,
                error: undefined
              }
            ])
          );

          return {
            likes: sanitizedLikes,
            pendingSync: [],
            lastSyncTime: {}
          };
        });
      },

      // ✅ REFACTORED: Упрощенный clearStorage
      clearStorage: () => {
        set({ 
          likes: {},
          pendingSync: [],
          lastSyncTime: {}
        });
        clearAllDebounceTimers();
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



