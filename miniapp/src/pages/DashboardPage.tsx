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
import { PackCard } from '@/components/PackCard';
import { StickerPackModal } from '@/components/StickerPackModal';
import { StickerSetResponse, LeaderboardUser } from '@/types/sticker';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';

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
      minHeight: '100%', 
      backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
      color: 'var(--tg-theme-text-color, #000000)',
      paddingBottom: 0
    }}>
      <StixlyPageContainer sx={{ py: 3, pb: 8 }}>
        {isLoading ? (
          <LoadingSpinner message="Загрузка статистики..." />
        ) : stats ? (
          <>
            <Box sx={{ mt: 1, mb: 2 }}>
              <Box
                sx={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  mb: 1,
                }}
              >
                <Button
                  onClick={toggleCategory}
                  variant="contained"
                  disableElevation
                  sx={{
                    borderRadius: '999px',
                    px: 3,
                    py: 1,
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    background: 'var(--tg-theme-button-color, #2563eb)',
                    color: 'var(--tg-theme-button-text-color, #ffffff)',
                    '&:hover': {
                      background: 'var(--tg-theme-button-color, #2563eb)',
                      filter: 'brightness(1.08)',
                    },
                  }}
                >
                  {activeCategoryKey === 'official' ? 'Официальные' : 'Пользовательские'}
                </Button>
              </Box>

              {topStickerSets.length > 0 && (
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
                        position: 'relative',
                        width: '100%',
                        maxWidth: { xs: '380px', sm: '540px', md: '680px' },
                        mx: 'auto',
                        height: { xs: 'clamp(240px, 72vw, 320px)', sm: 'clamp(280px, 52vw, 360px)' },
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        pb: { xs: 2.25, sm: 3 },
                        zIndex: 1,
                      }}
                    >
                      {row2Packs[0] && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: { xs: '12%', sm: '12%', md: '10%' },
                            left: { xs: '18%', sm: '20%', md: '26%' },
                            transform: 'translateX(-50%)',
                            width: { xs: 'clamp(138px, 38vw, 200px)', sm: 'clamp(160px, 30vw, 240px)' },
                            filter: 'drop-shadow(0 20px 36px rgba(8, 14, 30, 0.32))',
                            zIndex: 1,
                            '& .pack-card': {
                              width: '100% !important',
                              height: 'auto !important',
                              aspectRatio: '1 / 1.618',
                              transform: { xs: 'scale(0.94)', sm: 'scale(0.98)' },
                              transformOrigin: 'center bottom',
                            },
                          }}
                        >
                          <PackCard pack={row2Packs[0]} onClick={handlePackClick} />
                        </Box>
                      )}

                      {row1Pack && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: { xs: '-6%', sm: '-8%', md: '-10%' },
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: { xs: 'clamp(170px, 48vw, 220px)', sm: 'clamp(195px, 32vw, 260px)' },
                            zIndex: 2,
                            '& .pack-card': {
                              width: '100% !important',
                              height: 'auto !important',
                              aspectRatio: '1 / 1.618',
                              boxShadow: '0 28px 52px rgba(8, 14, 30, 0.38)',
                            },
                          }}
                        >
                          <PackCard pack={row1Pack} onClick={handlePackClick} />
                        </Box>
                      )}

                      {row2Packs[1] && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: { xs: '13%', sm: '12%', md: '10%' },
                            right: { xs: '14%', sm: '18%', md: '24%' },
                            transform: 'translateX(50%)',
                            width: { xs: 'clamp(138px, 38vw, 200px)', sm: 'clamp(160px, 30vw, 240px)' },
                            filter: 'drop-shadow(0 20px 36px rgba(8, 14, 30, 0.32))',
                            zIndex: 1,
                            '& .pack-card': {
                              width: '100% !important',
                              height: 'auto !important',
                              aspectRatio: '1 / 1.618',
                              transform: { xs: 'scale(0.94)', sm: 'scale(0.98)' },
                              transformOrigin: 'center bottom',
                            },
                          }}
                        >
                          <PackCard pack={row2Packs[1]} onClick={handlePackClick} />
                        </Box>
                      )}
                    </Box>
                    {hasAdditionalTopPacks && (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          width: '100%',
                          mt: { xs: 1.75, sm: 2 },
                        }}
                      >
                        <Button
                          onClick={handleViewFullTop}
                          variant="text"
                          sx={{
                            textTransform: 'none',
                            textDecoration: 'underline',
                            textDecorationColor: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.45))',
                            fontSize: '0.82rem',
                            fontWeight: 300,
                            color: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.7))',
                            px: 0,
                            py: 0.5,
                            minWidth: 'auto',
                            '&:hover': {
                              backgroundColor: 'transparent',
                              textDecoration: 'underline',
                              textDecorationColor: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.6))',
                              color: 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.85))',
                            },
                          }}
                        >
                          все стикеры
                        </Button>
                      </Box>
                    )}
                  </Box>
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

            {/* Топ пользователей по добавленным стикерам */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid
                item
                xs={12}
              >
                {topAuthors.length > 0 ? (
                  <TopUsers authors={topAuthors} />
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
                        Топ пользователей по добавленным стикерам
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
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" sx={{ color: 'var(--tg-theme-hint-color)' }}>
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
