/**
 * Оптимизированный hook для вычисления статистики Dashboard
 * Использует useMemo для избежания пересчета и requestIdleCallback для плавности
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { StickerSetResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';

export interface DashboardStats {
  totalStickerPacks: number;
  stickerPacksTrend: string;
  totalLikes: number;
  likesTodayTrend: string;
  artEarnedTotal: number;
  artEarnedTrend: string;
}

export interface AuthorStats {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  stickerCount: number;
  packCount: number;
}

interface UseDashboardStatsOptions {
  totalElements?: number;
  stickerSets: StickerSetResponse[];
  likes: Record<string, { isLiked: boolean; likesCount: number }>;
  maxTopStickers?: number;
  isOfficialChecker: (set: StickerSetResponse) => boolean;
}

interface UseDashboardStatsResult {
  stats: DashboardStats | null;
  topStickerSets: StickerSetResponse[];
  topStickersByCategory: Record<string, StickerSetResponse[]>;
  topAuthors: AuthorStats[];
  isLoading: boolean;
  error: Error | null;
}

export function useDashboardStats(options: UseDashboardStatsOptions): UseDashboardStatsResult {
  const {
    totalElements = 0,
    stickerSets,
    likes,
    maxTopStickers = 10,
    isOfficialChecker
  } = options;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topAuthors, setTopAuthors] = useState<AuthorStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadedSets, setLoadedSets] = useState<StickerSetResponse[]>([]);

  // ✅ ОПТИМИЗАЦИЯ 1: Мемоизация getStickerLikes
  const getStickerLikes = useCallback((stickerSet: StickerSetResponse): number => {
    return likes[stickerSet.id.toString()]?.likesCount ?? stickerSet.likesCount ?? stickerSet.likes ?? 0;
  }, [likes]);

  // ✅ ОПТИМИЗАЦИЯ 2: Загрузка данных (только при изменении totalElements)
  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.getStickerSets(0, 50);
        
        if (isCancelled) return;

        setLoadedSets(response.content || []);
      } catch (err) {
        if (!isCancelled) {
          console.warn('⚠️ Не удалось загрузить стикерсеты для статистики:', err);
          setError(err instanceof Error ? err : new Error('Loading failed'));
          setLoadedSets([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [totalElements]);

  // ✅ ОПТИМИЗАЦИЯ 3: Мемоизация выбора данных для статистики
  const setsForStats = useMemo(() => {
    return loadedSets.length > 0 ? loadedSets : stickerSets;
  }, [loadedSets, stickerSets]);

  // ✅ ОПТИМИЗАЦИЯ 4: Мемоизация общей статистики
  const calculatedStats = useMemo<DashboardStats>(() => {
    const totalStickerPacksInBase = loadedSets.length > 0 
      ? (totalElements || loadedSets.length) 
      : totalElements;

    // Подсчет лайков - один проход
    const totalLikesOnPlatform = setsForStats.reduce((sum, set) => {
      const setLikes = getStickerLikes(set);
      return sum + setLikes;
    }, 0);

    // Расчет трендов
    const packsPerDay = Math.floor(totalStickerPacksInBase * 0.02);
    const stickerPacksTrend = packsPerDay > 0 ? `+${packsPerDay}` : '+0';
    
    const likesToday = Math.floor(totalLikesOnPlatform * 0.05);
    const likesTodayTrend = likesToday > 0 ? `+${likesToday}` : '+0';
    
    const artEarnedTotal = 1234.5; // TODO: API endpoint
    const artTrend = artEarnedTotal > 0 ? `+${(artEarnedTotal * 0.1).toFixed(1)}` : '+0';

    return {
      totalStickerPacks: totalStickerPacksInBase,
      stickerPacksTrend,
      totalLikes: totalLikesOnPlatform,
      likesTodayTrend,
      artEarnedTotal,
      artEarnedTrend: artTrend
    };
  }, [setsForStats, loadedSets, totalElements, getStickerLikes]);

  // ✅ ОПТИМИЗАЦИЯ 5: Мемоизация топ стикерсетов
  const topStickerSets = useMemo(() => {
    return [...setsForStats]
      .sort((a, b) => getStickerLikes(b) - getStickerLikes(a))
      .slice(0, maxTopStickers);
  }, [setsForStats, getStickerLikes, maxTopStickers]);

  // ✅ ОПТИМИЗАЦИЯ 6: Мемоизация топ стикерсетов по категориям
  const topStickersByCategory = useMemo<Record<string, StickerSetResponse[]>>(() => {
    const officialTopSets = [...setsForStats]
      .filter(isOfficialChecker)
      .sort((a, b) => getStickerLikes(b) - getStickerLikes(a))
      .slice(0, maxTopStickers);

    const userTopSets = [...setsForStats]
      .filter(set => !isOfficialChecker(set))
      .sort((a, b) => getStickerLikes(b) - getStickerLikes(a))
      .slice(0, maxTopStickers);

    return {
      all: topStickerSets,
      official: officialTopSets,
      user: userTopSets
    };
  }, [setsForStats, isOfficialChecker, getStickerLikes, maxTopStickers, topStickerSets]);

  // ✅ ОПТИМИЗАЦИЯ 7: Расчет топ авторов в requestIdleCallback (не блокирует UI)
  useEffect(() => {
    if (setsForStats.length === 0) {
      setTopAuthors([]);
      return;
    }

    let isCancelled = false;

    const calculateTopAuthors = () => {
      if (isCancelled) return;

      const authorData = new Map<number, AuthorStats>();

      // Один проход по всем sets
      setsForStats.forEach(set => {
        const userId = set.userId;
        if (!userId) return;

        const current = authorData.get(userId) || {
          id: userId,
          username: set.username,
          firstName: set.firstName,
          lastName: set.lastName,
          avatarUrl: set.avatarUrl,
          stickerCount: 0,
          packCount: 0
        };
        
        const stickerCount = set.telegramStickerSetInfo?.stickers?.length || 0;
        
        authorData.set(userId, {
          ...current,
          stickerCount: current.stickerCount + stickerCount,
          packCount: current.packCount + 1
        });
      });

      // Сортируем и берем топ-5
      const topAuthorsList = Array.from(authorData.values())
        .sort((a, b) => b.stickerCount - a.stickerCount)
        .slice(0, 5);

      if (!isCancelled) {
        setTopAuthors(topAuthorsList);
      }
    };

    // Используем requestIdleCallback для плавности (не блокируем main thread)
    if ('requestIdleCallback' in window) {
      const handle = requestIdleCallback(calculateTopAuthors, { timeout: 2000 });
      
      return () => {
        isCancelled = true;
        cancelIdleCallback(handle);
      };
    } else {
      // Fallback для Safari
      const handle = setTimeout(calculateTopAuthors, 0);
      
      return () => {
        isCancelled = true;
        clearTimeout(handle);
      };
    }
  }, [setsForStats]);

  // Обновляем stats только когда calculatedStats изменился
  useEffect(() => {
    setStats(calculatedStats);
  }, [calculatedStats]);

  return {
    stats,
    topStickerSets,
    topStickersByCategory,
    topAuthors,
    isLoading,
    error
  };
}

