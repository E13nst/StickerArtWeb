import { useState, useCallback, useEffect, useMemo } from 'react';

interface UserBehavior {
  likedPacks: string[];
  viewedPacks: string[];
  searchHistory: string[];
  timeSpent: Record<string, number>; // packId -> время в мс
  categories: string[]; // извлеченные категории
}

interface Recommendation {
  id: string;
  title: string;
  reason: string;
  confidence: number; // 0-1
  type: 'similar' | 'trending' | 'personal' | 'category';
  pack: any;
}

interface SmartRecommendationsOptions {
  maxRecommendations?: number;
  minConfidence?: number;
  enableTrending?: boolean;
  enablePersonal?: boolean;
}

export const useSmartRecommendations = (options: SmartRecommendationsOptions = {}) => {
  const {
    maxRecommendations = 10,
    minConfidence = 0.3,
    enableTrending = true,
    enablePersonal = true
  } = options;

  const [userBehavior, setUserBehavior] = useState<UserBehavior>({
    likedPacks: [],
    viewedPacks: [],
    searchHistory: [],
    timeSpent: {},
    categories: []
  });

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Обновление поведения пользователя
  const updateBehavior = useCallback((updates: Partial<UserBehavior>) => {
    setUserBehavior(prev => ({ ...prev, ...updates }));
  }, []);

  // Отслеживание лайка
  const trackLike = useCallback((packId: string, isLiked: boolean) => {
    setUserBehavior(prev => ({
      ...prev,
      likedPacks: isLiked 
        ? [...prev.likedPacks, packId]
        : prev.likedPacks.filter(id => id !== packId)
    }));
  }, []);

  // Отслеживание просмотра
  const trackView = useCallback((packId: string, timeSpent: number = 0) => {
    setUserBehavior(prev => ({
      ...prev,
      viewedPacks: [...new Set([...prev.viewedPacks, packId])],
      timeSpent: {
        ...prev.timeSpent,
        [packId]: (prev.timeSpent[packId] || 0) + timeSpent
      }
    }));
  }, []);

  // Отслеживание поиска
  const trackSearch = useCallback((query: string) => {
    setUserBehavior(prev => ({
      ...prev,
      searchHistory: [...prev.searchHistory, query].slice(-20) // Последние 20
    }));
  }, []);

  // Извлечение категорий из поведения
  const extractCategories = useCallback((packs: any[], likedPacks: string[]) => {
    const likedPackData = packs.filter(pack => likedPacks.includes(pack.id));
    const categories: string[] = [];

    // Анализируем названия и теги
    likedPackData.forEach(pack => {
      const title = pack.title.toLowerCase();
      
      // Простое извлечение категорий по ключевым словам
      if (title.includes('кот') || title.includes('котик')) categories.push('коты');
      if (title.includes('собака') || title.includes('пес')) categories.push('собаки');
      if (title.includes('аниме') || title.includes('anime')) categories.push('аниме');
      if (title.includes('мем') || title.includes('meme')) categories.push('мемы');
      if (title.includes('смешн') || title.includes('funny')) categories.push('смешные');
      if (title.includes('любов') || title.includes('love')) categories.push('любовь');
      if (title.includes('еда') || title.includes('food')) categories.push('еда');
    });

    return [...new Set(categories)];
  }, []);

  // Генерация рекомендаций
  const generateRecommendations = useCallback(async (allPacks: any[]) => {
    setIsLoading(true);

    try {
      const newRecommendations: Recommendation[] = [];

      // 1. Похожие на лайкнутые
      if (enablePersonal && userBehavior.likedPacks.length > 0) {
        const likedPackData = allPacks.filter(pack => 
          userBehavior.likedPacks.includes(pack.id)
        );

        likedPackData.forEach(likedPack => {
          const similarPacks = allPacks
            .filter(pack => 
              pack.id !== likedPack.id && 
              !userBehavior.likedPacks.includes(pack.id)
            )
            .map(pack => ({
              id: pack.id,
              title: pack.title,
              reason: `Похоже на "${likedPack.title}"`,
              confidence: calculateSimilarity(likedPack, pack),
              type: 'similar' as const,
              pack
            }))
            .filter(rec => rec.confidence >= minConfidence)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);

          newRecommendations.push(...similarPacks);
        });
      }

      // 2. Трендовые
      if (enableTrending) {
        const trendingPacks = allPacks
          .filter(pack => !userBehavior.likedPacks.includes(pack.id))
          .map(pack => ({
            id: pack.id,
            title: pack.title,
            reason: 'Популярно сейчас',
            confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
            type: 'trending' as const,
            pack
          }))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3);

        newRecommendations.push(...trendingPacks);
      }

      // 3. По категориям
      const categories = extractCategories(allPacks, userBehavior.likedPacks);
      if (categories.length > 0) {
        const categoryPacks = allPacks
          .filter(pack => 
            !userBehavior.likedPacks.includes(pack.id) &&
            categories.some(cat => 
              pack.title.toLowerCase().includes(cat.toLowerCase())
            )
          )
          .map(pack => ({
            id: pack.id,
            title: pack.title,
            reason: `В категории "${categories[0]}"`,
            confidence: 0.7,
            type: 'category' as const,
            pack
          }))
          .slice(0, 2);

        newRecommendations.push(...categoryPacks);
      }

      // 4. Персональные на основе поиска
      if (userBehavior.searchHistory.length > 0) {
        const searchTerms = [...new Set(userBehavior.searchHistory)].slice(-3);
        const searchPacks = allPacks
          .filter(pack => 
            !userBehavior.likedPacks.includes(pack.id) &&
            searchTerms.some(term => 
              pack.title.toLowerCase().includes(term.toLowerCase())
            )
          )
          .map(pack => ({
            id: pack.id,
            title: pack.title,
            reason: 'По вашим поискам',
            confidence: 0.8,
            type: 'personal' as const,
            pack
          }))
          .slice(0, 2);

        newRecommendations.push(...searchPacks);
      }

      // Убираем дубликаты и сортируем
      const uniqueRecommendations = newRecommendations
        .filter((rec, index, arr) => 
          arr.findIndex(r => r.id === rec.id) === index
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxRecommendations);

      setRecommendations(uniqueRecommendations);
    } catch (error) {
      console.warn('Ошибка генерации рекомендаций:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userBehavior, minConfidence, maxRecommendations, enablePersonal, enableTrending, extractCategories]);

  // Простой алгоритм схожести
  const calculateSimilarity = useCallback((pack1: any, pack2: any) => {
    const title1 = pack1.title.toLowerCase();
    const title2 = pack2.title.toLowerCase();
    
    // Простое сравнение по ключевым словам
    const words1 = title1.split(' ');
    const words2 = title2.split(' ');
    
    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = commonWords.length / Math.max(words1.length, words2.length);
    
    return Math.min(similarity + Math.random() * 0.2, 1); // Добавляем немного случайности
  }, []);

  // Обновление категорий при изменении лайков
  useEffect(() => {
    if (userBehavior.likedPacks.length > 0) {
      // Здесь можно добавить логику обновления категорий
      // когда у нас есть доступ к данным паков
    }
  }, [userBehavior.likedPacks]);

  return {
    recommendations,
    isLoading,
    userBehavior,
    updateBehavior,
    trackLike,
    trackView,
    trackSearch,
    generateRecommendations,
    clearRecommendations: () => setRecommendations([])
  };
};
