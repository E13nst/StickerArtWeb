import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Box, Typography, Grid, Card, CardContent, Skeleton, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/hooks/useTelegram';
import { useStickerStore } from '@/store/useStickerStore';
import { useLikesStore } from '@/store/useLikesStore';
import { useProfileStore } from '@/store/useProfileStore';
import { apiClient } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MetricCard } from '@/components/MetricCard';
import { TopCategories } from '@/components/TopCategories';
import { TopAuthors } from '@/components/TopAuthors';
import { CategoryFilter, Category as CategoryFilterOption } from '@/components/CategoryFilter';
import { PackCard } from '@/components/PackCard';
import { StickerPackModal } from '@/components/StickerPackModal';
import { StickerSetResponse } from '@/types/sticker';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';

interface DashboardStats {
  totalStickerPacks: number; // Всего стикерпаков в базе
  stickerPacksTrend: string; // Тренд за день
  totalLikes: number; // Всего лайков на платформе
  likesTodayTrend: string; // Лайков за сегодня
  artEarnedTotal: number; // ART earned total
  artEarnedTrend: string;
}

interface CategoryStats {
  name: string;
  count: number;
  emoji: string;
}

export const DashboardPage: React.FC = () => {
  const MAX_TOP_STICKERS = 10;
  const navigate = useNavigate();
  const { isInTelegramApp, user } = useTelegram();
  const { totalElements, stickerSets } = useStickerStore();
  const { likes } = useLikesStore();
  const { userInfo, userStickerSets } = useProfileStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topCategories, setTopCategories] = useState<CategoryStats[]>([]);
  const [topStickerSets, setTopStickerSets] = useState<StickerSetResponse[]>([]);
  const [topAuthors, setTopAuthors] = useState<Array<{ id: number; username?: string; firstName?: string; lastName?: string; avatarUrl?: string; stickerCount: number; packCount: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const categoryFilterOptions = useMemo<CategoryFilterOption[]>(() => [
    { id: 'official', label: 'Официальные', title: 'Официальные наборы' },
    { id: 'user', label: 'Пользовательские', title: 'Пользовательские наборы' }
  ], []);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>('official');
  const [topStickersByCategory, setTopStickersByCategory] = useState<Record<string, StickerSetResponse[]>>({
    official: [],
    user: [],
    all: []
  });
  const pyramidPacks = useMemo(() => adaptStickerSetsToGalleryPacks(topStickerSets), [topStickerSets]);
  const row1Pack = pyramidPacks[0];
  const row2Packs = pyramidPacks.slice(1, 3);
  const scrollPacks = pyramidPacks.slice(3, MAX_TOP_STICKERS);
  const hasAdditionalTopPacks = scrollPacks.length > 0;

  const handleViewFullTop = useCallback(() => {
    navigate('/gallery?sort=likes');
  }, [navigate]);

  const handlePackClick = (packId: string) => {
    const stickerSet = topStickerSets.find(s => s.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleStickerSetUpdated = useCallback((updated: StickerSetResponse) => {
    const updateList = (list: StickerSetResponse[]) => {
      if (!list.some((set) => set.id === updated.id)) {
        return list;
      }
      if (updated.isPublic === false) {
        return list.filter((set) => set.id !== updated.id);
      }
      return list.map((set) => (set.id === updated.id ? { ...set, ...updated } : set));
    };

    setTopStickerSets((prev) => updateList(prev));
    setTopStickersByCategory((prev) => {
      const next: Record<string, StickerSetResponse[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = updateList(prev[key]);
      });
      return next;
    });
    setSelectedStickerSet((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

  const quickActions = [
    { label: 'AI-Tools' },
    { label: 'Earn ART' },
    { label: 'NFT 2.0' },
  ];

  const isOfficialStickerSet = useCallback((stickerSet: StickerSetResponse): boolean => {
    const rawFlag = (stickerSet as any)?.isOfficial ?? (stickerSet as any)?.official ?? (stickerSet as any)?.officialStatus;

    if (typeof rawFlag === 'boolean') {
      return rawFlag;
    }

    if (typeof rawFlag === 'string') {
      const normalized = rawFlag.toLowerCase();
      if (['official', 'true', 'yes', '1'].includes(normalized)) {
        return true;
      }
      if (['user', 'false', 'no', '0'].includes(normalized)) {
        return false;
      }
    }

    if (typeof rawFlag === 'number') {
      return rawFlag === 1;
    }

    if (typeof stickerSet.userId === 'number') {
      return false;
    }

    return true;
  }, []);

  // Подсчет статистики с трендами
  useEffect(() => {
    const calculateStats = async () => {
      setIsLoading(true);
      try {
        // Всего стикерпаков в базе - получаем из API если totalElements не загружен
        let totalStickerPacksInBase = totalElements || 0;
        
        // Загружаем данные из API для получения полной статистики
        let loadedStickerSets: StickerSetResponse[] = [];
        try {
          const response = await apiClient.getStickerSets(0, 50); // Загружаем больше для статистики
          totalStickerPacksInBase = response.totalElements || totalStickerPacksInBase || 0;
          loadedStickerSets = response.content || [];
          console.log('📊 Загружено стикерсетов для статистики:', loadedStickerSets.length);
        } catch (e) {
          console.warn('⚠️ Не удалось загрузить стикерсеты:', e);
        }
        
        // Используем загруженные данные или данные из store
        const setsForStats = loadedStickerSets.length > 0 ? loadedStickerSets : stickerSets;
        
        console.log('📊 Dashboard stats:', {
          totalElements,
          totalStickerPacksInBase,
          stickerSetsCount: stickerSets.length,
          loadedStickerSetsCount: loadedStickerSets.length,
          setsForStatsCount: setsForStats.length,
          likesCount: Object.values(likes).length
        });
        
        // Получаем общее количество лайков на платформе (суммируем все likesCount)
        // Это сумма всех лайков по всем стикерсетам
        const totalLikesOnPlatform = setsForStats.reduce((sum, set) => {
          const setLikes = likes[set.id.toString()]?.likesCount || set.likesCount || 0;
          return sum + setLikes;
        }, 0);
        
        // Подсчитываем общее количество стикеров на платформе
        const totalStickersCount = setsForStats.reduce((sum, set) => {
          const stickerCount = set.telegramStickerSetInfo?.stickers?.length || 0;
          return sum + stickerCount;
        }, 0);
        
        console.log('📊 Статистика:', {
          totalStickerPacksInBase,
          totalLikesOnPlatform,
          totalStickersCount
        });

        // ART earned total - общий заработок ART на платформе
        // TODO: Заменить на реальный API endpoint для получения общей статистики ART
        // Пока используем заглушку для демонстрации
        const artEarnedTotal = 1234.5; // Заглушка: будет заменено на реальные данные из API

        // Расчет трендов за день/сегодня
        // Для стикерпаков: предполагаем рост ~2% в день
        const packsPerDay = Math.floor(totalStickerPacksInBase * 0.02);
        const stickerPacksTrend = packsPerDay > 0 ? `+${packsPerDay}` : '+0';
        
        // Для лайков за сегодня: предполагаем ~5% от общего количества
        const likesToday = Math.floor(totalLikesOnPlatform * 0.05);
        const likesTodayTrend = likesToday > 0 ? `+${likesToday}` : '+0';
        
        // Для ART: предполагаем рост ~10% от текущего баланса
        const artTrend = artEarnedTotal > 0 ? `+${(artEarnedTotal * 0.1).toFixed(1)}` : '+0';

        setStats({
          totalStickerPacks: totalStickerPacksInBase,
          stickerPacksTrend,
          totalLikes: totalLikesOnPlatform,
          likesTodayTrend,
          artEarnedTotal,
          artEarnedTrend: artTrend
        });

        const getStickerLikes = (stickerSet: StickerSetResponse): number =>
          likes[stickerSet.id.toString()]?.likesCount ?? stickerSet.likesCount ?? stickerSet.likes ?? 0;

        const sortedSets = [...setsForStats]
          .sort((a, b) => getStickerLikes(b) - getStickerLikes(a))
          .slice(0, MAX_TOP_STICKERS);

        console.log('📊 Отсортировано стикерсетов для топ-5:', sortedSets.length);

        const officialTopSets = [...setsForStats]
          .filter((set) => isOfficialStickerSet(set))
          .sort((a, b) => getStickerLikes(b) - getStickerLikes(a))
          .slice(0, MAX_TOP_STICKERS);

        const userTopSets = [...setsForStats]
          .filter((set) => !isOfficialStickerSet(set))
          .sort((a, b) => getStickerLikes(b) - getStickerLikes(a))
          .slice(0, MAX_TOP_STICKERS);

        const stickersByCategoryMap: Record<string, StickerSetResponse[]> = {
          all: sortedSets,
          official: officialTopSets,
          user: userTopSets
        };

        // Получаем категории и сортируем по лайкам
        try {
          const categories = await apiClient.getCategories();
          console.log('📊 Загружено категорий:', categories.length);

          const categoryData = new Map<string, { count: number; likes: number }>();

          setsForStats.forEach(set => {
            const setLikes = getStickerLikes(set);
            if (set.categories && set.categories.length > 0) {
              set.categories.forEach(cat => {
                const current = categoryData.get(cat.key) || { count: 0, likes: 0 };
                categoryData.set(cat.key, {
                  count: current.count + 1,
                  likes: current.likes + setLikes
                });
              });
            }
          });

          console.log('📊 Категории с данными:', Array.from(categoryData.entries()));

          const categoryEmojis: Record<string, string> = {
            art: '🎨',
            animals: '🐱',
            memes: '😂',
            premium: '🌟',
            love: '❤️',
            nature: '🌿',
            food: '🍕',
            travel: '✈️',
            sports: '⚽',
            music: '🎵'
          };

          const sortedCategoryEntries = Array.from(categoryData.entries())
            .sort((a, b) => b[1].likes - a[1].likes);

          const topCategoriesList = sortedCategoryEntries
            .map(([key, data]) => {
              const category = categories.find(c => c.key === key);
              return {
                name: category?.name || key,
                count: data.likes,
                emoji: categoryEmojis[key] || '📦'
              };
            })
            .slice(0, 8);

          console.log('📊 Топ категорий:', topCategoriesList);
          if (topCategoriesList.length === 0) {
            console.warn('⚠️ Нет категорий, используем заглушку');
            setTopCategories([
              { name: 'Арт', count: 0, emoji: '🎨' },
              { name: 'Животные', count: 0, emoji: '🐱' },
              { name: 'Мемы', count: 0, emoji: '😂' },
              { name: 'Премиум', count: 0, emoji: '🌟' },
              { name: 'Любовь', count: 0, emoji: '❤️' }
            ]);
          } else {
            setTopCategories(topCategoriesList);
          }

        } catch (e) {
          console.warn('Не удалось загрузить категории');
          setTopCategories([
            { name: 'Арт', count: 8, emoji: '🎨' },
            { name: 'Животные', count: 6, emoji: '🐱' },
            { name: 'Мемы', count: 5, emoji: '😂' },
            { name: 'Премиум', count: 3, emoji: '🌟' },
            { name: 'Любовь', count: 2, emoji: '❤️' }
          ]);
        }

        setTopStickersByCategory(stickersByCategoryMap);

        // Получаем топ-5 авторов по количеству стикеров
        try {
          const authorData = new Map<number, {
            id: number;
            username?: string;
            firstName?: string;
            lastName?: string;
            avatarUrl?: string;
            stickerCount: number;
            packCount: number;
          }>();

          setsForStats.forEach(set => {
            const userId = set.userId;
            if (userId) {
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
            }
          });

          // Сортируем по количеству стикеров и берем топ-5
          const topAuthorsList = Array.from(authorData.values())
            .sort((a, b) => b.stickerCount - a.stickerCount)
            .slice(0, 5);

          console.log('📊 Топ авторов:', topAuthorsList);
          
          // Если авторов нет, добавляем заглушки
          if (topAuthorsList.length === 0) {
            console.warn('⚠️ Нет авторов, используем заглушку');
            setTopAuthors([]);
          } else {
            setTopAuthors(topAuthorsList);
          }
        } catch (e) {
          console.warn('Не удалось загрузить топ авторов:', e);
          setTopAuthors([]);
        }
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
      } finally {
        setIsLoading(false);
      }
    };

    calculateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalElements, userInfo]);

  useEffect(() => {
    if (!categoryFilterOptions.some((option) => option.id === activeCategoryKey)) {
      setActiveCategoryKey(categoryFilterOptions[0]?.id ?? 'official');
    }
  }, [activeCategoryKey, categoryFilterOptions]);

  useEffect(() => {
    const nextTopStickers = topStickersByCategory[activeCategoryKey] ?? topStickersByCategory.all ?? [];
    setTopStickerSets(nextTopStickers);
  }, [activeCategoryKey, topStickersByCategory]);

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
      color: 'var(--tg-theme-text-color, #000000)',
      paddingBottom: 0
    }}>
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, py: 3 }}>
        {isLoading ? (
          <LoadingSpinner message="Загрузка статистики..." />
        ) : stats ? (
          <>
            <Box sx={{ mt: 1, mb: 3 }}>
              {categoryFilterOptions.length > 0 && (
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 1.5,
                  }}
                >
                  <CategoryFilter
                    categories={categoryFilterOptions}
                    selectedCategories={[activeCategoryKey]}
                    onCategoryToggle={(categoryId) => setActiveCategoryKey(categoryId)}
                    disabled={isLoading}
                  />
                </Box>
              )}

              {topStickerSets.length > 0 ? (
                <>
                  <Box sx={{ position: 'relative', width: '100%' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: { xs: '40vw', sm: '30vw', md: '18vw' },
                        opacity: 0.23,
                        pointerEvents: 'none',
                        zIndex: 0,
                        transform: 'translateY(-6%)',
                      }}
                      aria-hidden
                    >
                      🏆
                    </Box>
                    <Box
                      sx={{
                        '--base-size': 'clamp(110px, 28vw, 220px)',
                        '--row-gap': 'calc(var(--base-size) * 0.18)',
                        '--col-gap': 'calc(var(--base-size) * 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--row-gap)',
                        width: '100%',
                        pb: 2,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'row',
                          flexWrap: { xs: 'nowrap', sm: 'nowrap' },
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 'var(--col-gap)',
                          width: '100%',
                        }}
                      >
                        {row2Packs[0] && (
                          <Box
                            sx={{
                              flex: {
                                xs: '0 0 clamp(86px, calc(var(--base-size) * 0.786), 220px)',
                                sm: '0 0 clamp(105px, calc(var(--base-size) * 0.786), 240px)',
                              },
                              maxWidth: {
                                xs: 'clamp(86px, calc(var(--base-size) * 0.786), 220px)',
                                sm: 'clamp(105px, calc(var(--base-size) * 0.786), 240px)',
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: '100%',
                                '& .pack-card': {
                                  width: '100% !important',
                                  height: 'auto !important',
                                  aspectRatio: '1 / 1.618',
                                },
                              }}
                            >
                              <PackCard pack={row2Packs[0]} onClick={handlePackClick} />
                            </Box>
                          </Box>
                        )}

                        {row1Pack && (
                          <Box
                            sx={{
                              width: 'min(var(--base-size), 100%)',
                              transformOrigin: 'center',
                              '& .pack-card': {
                                width: '100% !important',
                                height: 'auto !important',
                                aspectRatio: '1 / 1.618',
                              },
                            }}
                          >
                            <PackCard pack={row1Pack} onClick={handlePackClick} />
                          </Box>
                        )}

                        {row2Packs[1] && (
                          <Box
                            sx={{
                              flex: {
                                xs: '0 0 clamp(86px, calc(var(--base-size) * 0.786), 220px)',
                                sm: '0 0 clamp(105px, calc(var(--base-size) * 0.786), 240px)',
                              },
                              maxWidth: {
                                xs: 'clamp(86px, calc(var(--base-size) * 0.786), 220px)',
                                sm: 'clamp(105px, calc(var(--base-size) * 0.786), 240px)',
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: '100%',
                                '& .pack-card': {
                                  width: '100% !important',
                                  height: 'auto !important',
                                  aspectRatio: '1 / 1.618',
                                },
                              }}
                            >
                              <PackCard pack={row2Packs[1]} onClick={handlePackClick} />
                            </Box>
                          </Box>
                        )}
                      </Box>

                      {hasAdditionalTopPacks && (
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            width: '100%',
                            mt: 0.5,
                          }}
                        >
                          <Button
                            onClick={handleViewFullTop}
                            variant="text"
                            sx={{
                              textTransform: 'none',
                              textDecoration: 'underline',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: 'var(--tg-theme-button-color, #6C63FF)',
                              px: 0,
                              py: 0.5,
                              minWidth: 'auto',
                              '&:hover': {
                                backgroundColor: 'transparent',
                                textDecoration: 'underline',
                                color: 'var(--tg-theme-button-color, #5A48D0)',
                              },
                            }}
                          >
                            все стикеры
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <Card
                    sx={{
                      mt: 2,
                      borderRadius: 3,
                      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                      border: '1px solid var(--tg-theme-border-color)',
                      boxShadow: 'none',
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'var(--tg-theme-hint-color)',
                          fontSize: '0.9rem',
                        }}
                      >
                        В этой категории пока нет стикеров. Попробуйте выбрать другую.
                      </Typography>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card
                  sx={{
                    mt: 2,
                    borderRadius: 3,
                    backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                    border: '1px solid var(--tg-theme-border-color)',
                    boxShadow: 'none',
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'var(--tg-theme-hint-color)',
                        fontSize: '0.9rem',
                      }}
                    >
                      В этой категории пока нет стикеров. Попробуйте выбрать другую.
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Box>

            {quickActions.length > 0 && (
              <Box
                sx={{
                  position: 'relative',
                  mt: 0.75,
                  mb: 3,
                  px: 1,
                  overflow: 'visible',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: '-60px -200px',
                    pointerEvents: 'none',
                    zIndex: 0,
                    opacity: 0.65,
                    filter: 'blur(50px)',
                    background:
                      'radial-gradient(circle at 20% 40%, rgba(79,70,229,0.28) 0%, rgba(16,18,26,0) 56%),\
                       radial-gradient(circle at 60% 20%, rgba(236,72,153,0.24) 0%, rgba(16,18,26,0) 62%),\
                       radial-gradient(circle at 80% 60%, rgba(16,185,129,0.28) 0%, rgba(16,18,26,0) 58%)',
                  }}
                />
                <Box
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                    px: { xs: 0.5, md: 1 },
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))' },
                      gap: '12px',
                      width: '100%',
                      maxWidth: '360px',
                    }}
                  >
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(18, 22, 32, 0.82)',
                          color: '#f1f5ff',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'default',
                          outline: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          boxShadow: 'none',
                          backgroundBlendMode: 'normal',
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* Топ-5 авторов */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid
                item
                xs={12}
              >
                {topAuthors.length > 0 ? (
                  <TopAuthors authors={topAuthors} />
                ) : (
                  <Card
                    sx={{
                      borderRadius: 3,
                      backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                      border: '1px solid var(--tg-theme-border-color)',
                      boxShadow: 'none',
                      height: '100%',
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'var(--tg-theme-hint-color)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          mb: 1.5,
                        }}
                      >
                        Топ-5 авторов
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'var(--tg-theme-hint-color)',
                          fontSize: '0.75rem',
                        }}
                      >
                        Загрузка...
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>

            {/* Топ-5 категорий */}
            {topCategories.length > 0 && (
              <TopCategories categories={topCategories} />
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" sx={{ color: 'var(--tg-theme-hint-color)' }}>
              Не удалось загрузить статистику
            </Typography>
          </Box>
        )}
      </Container>

      {/* Модалка деталей стикерсета */}
      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStickerSet(null);
        }}
        onLike={(id) => {
          // Переключение лайка через store
          useLikesStore.getState().toggleLike(String(id));
        }}
        onStickerSetUpdated={handleStickerSetUpdated}
      />
    </Box>
  );
};
