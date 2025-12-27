import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Skeleton, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/hooks/useTelegram';
import { useStickerStore } from '@/store/useStickerStore';
import { useLikesStore } from '@/store/useLikesStore';
import { useProfileStore } from '@/store/useProfileStore';
import { apiClient } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MetricCard } from '@/components/MetricCard';
import { TopUsers } from '@/components/TopUsers';
import { TopAuthors } from '@/components/TopAuthors';
import { PackCard } from '@/components/PackCard';
import { StickerPackModal } from '@/components/StickerPackModal';
import { StickerSetResponse, LeaderboardUser, LeaderboardAuthor } from '@/types/sticker';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import '@/styles/common.css';
import '@/styles/DashboardPage.css';

// Утилита для объединения классов
const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

interface DashboardStats {
  totalStickerPacks: number; // Всего стикерпаков в базе
  stickerPacksTrend: string; // Тренд за день
  totalLikes: number; // Всего лайков на платформе
  likesTodayTrend: string; // Лайков за сегодня
  artEarnedTotal: number; // ART earned total
  artEarnedTrend: string;
}

type CategoryFilterOption = {
  id: string;
  label: string;
  title?: string;
};

export const DashboardPage: React.FC = () => {
  const MAX_TOP_STICKERS = 10;
  const navigate = useNavigate();
  const { isInTelegramApp, user } = useTelegram();
  const { totalElements, stickerSets } = useStickerStore();
  const { likes } = useLikesStore();
  const { userInfo, userStickerSets } = useProfileStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topStickerSets, setTopStickerSets] = useState<StickerSetResponse[]>([]);
  const [topAuthors, setTopAuthors] = useState<LeaderboardUser[]>([]);
  const [topAuthorsList, setTopAuthorsList] = useState<LeaderboardAuthor[]>([]);
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

  const toggleCategory = useCallback(() => {
    setActiveCategoryKey((prev) => (prev === 'official' ? 'user' : 'official'));
  }, []);

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
    setSelectedStickerSet(updated);

    setTopStickerSets((prev) =>
      prev.map((set) => (set.id === updated.id ? { ...set, ...updated } : set))
    );

    setTopStickersByCategory((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([key, list]) => {
        next[key] = list.map((set) => (set.id === updated.id ? { ...set, ...updated } : set));
      });
      return next;
    });
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
        
        // Загружаем топ-3 ОФИЦИАЛЬНЫХ стикерсета по лайкам с preview=true для оптимизации
        let officialStickerSets: StickerSetResponse[] = [];
        try {
          const officialResponse = await apiClient.getStickerSets(0, 3, {
            type: 'OFFICIAL',
            sort: 'likesCount',
            direction: 'DESC',
            preview: true
          });
          officialStickerSets = officialResponse.content || [];
          console.log('📊 Загружено топ-3 ОФИЦИАЛЬНЫХ стикерсета по лайкам:', officialStickerSets.length);
        } catch (e) {
          console.warn('⚠️ Не удалось загрузить официальные стикерсеты:', e);
        }
        
        // Загружаем топ-3 ПОЛЬЗОВАТЕЛЬСКИХ стикерсета по лайкам с preview=true для оптимизации
        let userStickerSets: StickerSetResponse[] = [];
        try {
          const userResponse = await apiClient.getStickerSets(0, 3, {
            type: 'USER',
            sort: 'likesCount',
            direction: 'DESC',
            preview: true
          });
          userStickerSets = userResponse.content || [];
          console.log('📊 Загружено топ-3 ПОЛЬЗОВАТЕЛЬСКИХ стикерсета по лайкам:', userStickerSets.length);
        } catch (e) {
          console.warn('⚠️ Не удалось загрузить пользовательские стикерсеты:', e);
        }
        
        // Получаем общее количество элементов из первого успешного ответа
        try {
          const countResponse = await apiClient.getStickerSets(0, 1, {
            sort: 'id',
            direction: 'DESC'
          });
          totalStickerPacksInBase = countResponse.totalElements || totalStickerPacksInBase || 0;
        } catch (e) {
          console.warn('⚠️ Не удалось загрузить общее количество стикерсетов:', e);
        }
        
        // Объединяем загруженные данные для подсчета статистики
        const loadedStickerSets = [...officialStickerSets, ...userStickerSets];
        
        // Используем загруженные данные или данные из store
        const setsForStats = loadedStickerSets.length > 0 ? loadedStickerSets : stickerSets;
        
        console.log('📊 Dashboard stats:', {
          totalElements,
          totalStickerPacksInBase,
          stickerSetsCount: stickerSets.length,
          officialCount: officialStickerSets.length,
          userCount: userStickerSets.length,
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

        // Сортируем все загруженные стикерсеты для общего топа
        const sortedSets = [...setsForStats]
          .sort((a, b) => getStickerLikes(b) - getStickerLikes(a))
          .slice(0, MAX_TOP_STICKERS);

        console.log('📊 Отсортировано стикерсетов для топа:', sortedSets.length);

        // Используем загруженные данные напрямую (они уже отсортированы по лайкам)
        const officialTopSets = officialStickerSets.slice(0, MAX_TOP_STICKERS);
        const userTopSets = userStickerSets.slice(0, MAX_TOP_STICKERS);

        const stickersByCategoryMap: Record<string, StickerSetResponse[]> = {
          all: sortedSets,
          official: officialTopSets,
          user: userTopSets
        };

        setTopStickersByCategory(stickersByCategoryMap);

        // Получаем топ-5 пользователей из лидерборда
        try {
          const leaderboardResponse = await apiClient.getUsersLeaderboard(0, 5);
          const topUsers = leaderboardResponse.content.slice(0, 5);
          
          console.log('📊 Топ пользователей из лидерборда:', topUsers);
          setTopAuthors(topUsers);
        } catch (e) {
          console.warn('Не удалось загрузить лидерборд:', e);
          setTopAuthors([]);
        }

        // Получаем топ-5 авторов из лидерборда
        try {
          const authorsLeaderboardResponse = await apiClient.getAuthorsLeaderboard(0, 5);
          const topAuthorsData = authorsLeaderboardResponse.content.slice(0, 5);
          
          console.log('📊 Топ авторов из лидерборда:', topAuthorsData);
          setTopAuthorsList(topAuthorsData);
        } catch (e) {
          console.warn('Не удалось загрузить лидерборд авторов:', e);
          setTopAuthorsList([]);
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
    <Box className="page-container-full-height">
      <StixlyPageContainer className="page-container-padding-y dashboard-container">
        {isLoading ? (
          <LoadingSpinner message="Загрузка статистики..." />
        ) : stats ? (
          <>
            <Box className="dashboard-category-section">
              <Box className="flex-center dashboard-category-button-container">
                <Button
                  onClick={toggleCategory}
                  variant="contained"
                  disableElevation
                  className="button-base button-rounded dashboard-category-button"
                >
                  {activeCategoryKey === 'official' ? 'Официальные' : 'Пользовательские'}
                </Button>
              </Box>

              {topStickerSets.length > 0 && (
                  <Box className="dashboard-pyramid-container">
                    <Box className="dashboard-pyramid-trophy" aria-hidden>
                      🏆
                    </Box>
                    <Box className="dashboard-pyramid-content">
                      {row2Packs[0] && (
                        <Box className="dashboard-pyramid-pack-left">
                          <PackCard pack={row2Packs[0]} onClick={handlePackClick} />
                        </Box>
                      )}

                      {row1Pack && (
                        <Box className="dashboard-pyramid-pack-center">
                          <PackCard pack={row1Pack} onClick={handlePackClick} />
                        </Box>
                      )}

                      {row2Packs[1] && (
                        <Box className="dashboard-pyramid-pack-right">
                          <PackCard pack={row2Packs[1]} onClick={handlePackClick} />
                        </Box>
                      )}
                    </Box>
                    {hasAdditionalTopPacks && (
                      <Box className="flex-center dashboard-view-all-button-container">
                        <Button
                          onClick={handleViewFullTop}
                          variant="text"
                          className="dashboard-view-all-button"
                        >
                          все стикеры
                        </Button>
                      </Box>
                    )}
                  </Box>
              )}
            </Box>

            {quickActions.length > 0 && (
              <Box className="dashboard-quick-actions-container">
                <Box className="dashboard-quick-actions-background" />
                <Box className="dashboard-quick-actions-content">
                  <Box className="dashboard-quick-actions-grid">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        disabled
                        className="button-base button-rounded-lg dashboard-quick-action-button"
                      >
                        {action.label}
                      </button>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* Топ пользователей по добавленным стикерам */}
            <Grid container spacing={2} className="dashboard-top-users-grid">
              <Grid
                item
                xs={12}
              >
                {topAuthors.length > 0 ? (
                  <TopUsers authors={topAuthors} />
                ) : (
                  <Card className={cn('card-base', 'dashboard-top-users-card')}>
                    <CardContent className="dashboard-top-users-card-content">
                      <Typography
                        variant="body2"
                        className="dashboard-top-users-title"
                      >
                        Топ пользователей по добавленным стикерам
                      </Typography>
                      <Typography
                        variant="body2"
                        className="dashboard-top-users-text"
                      >
                        Загрузка...
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>

            {/* Топ авторов стикерсетов */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid
                item
                xs={12}
              >
                {topAuthorsList.length > 0 ? (
                  <TopAuthors authors={topAuthorsList} />
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
                        Топ авторов стикерсетов
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

            {/* Дополнительный отступ внизу, чтобы лидерборд был виден над BottomNav */}
            <Box sx={{ height: { xs: '140px', sm: '160px' }, flexShrink: 0 }} />

          </>
        ) : (
          <Box className={cn('flex-center', 'error-text-container')}>
            <Typography variant="body1" className="error-text">
              Не удалось загрузить статистику
            </Typography>
          </Box>
        )}
      </StixlyPageContainer>

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
