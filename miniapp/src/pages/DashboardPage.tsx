import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Skeleton, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/hooks/useTelegram';
import { useStickerStore } from '@/store/useStickerStore';
import { useLikesStore } from '@/store/useLikesStore';
import { useProfileStore } from '@/store/useProfileStore';
import { apiClient } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatisticsCard } from '@/components/StatisticsCard';
import { StickersCarousel } from '@/components/StickersCarousel';
import { DailyActivity } from '@/components/DailyActivity';
import { TopUsers } from '@/components/TopUsers';
import { TopAuthors } from '@/components/TopAuthors';
import { StickerPackModal } from '@/components/StickerPackModal';
import { StickerSetResponse, LeaderboardUser, LeaderboardAuthor } from '@/types/sticker';
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


export const DashboardPage: React.FC = () => {
  const MAX_TOP_STICKERS = 10;
  const navigate = useNavigate();
  const { isInTelegramApp, user } = useTelegram();
  const { totalElements, stickerSets } = useStickerStore();
  const { likes } = useLikesStore();
  const { userInfo } = useProfileStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [officialStickerSets, setOfficialStickerSets] = useState<StickerSetResponse[]>([]);
  const [userStickerSets, setUserStickerSets] = useState<StickerSetResponse[]>([]);
  const [topAuthors, setTopAuthors] = useState<LeaderboardUser[]>([]);
  const [topAuthorsList, setTopAuthorsList] = useState<LeaderboardAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePackClick = (packId: string) => {
    const allSets = [...officialStickerSets, ...userStickerSets];
    const stickerSet = allSets.find(s => s.id.toString() === packId);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleStickerSetUpdated = useCallback((updated: StickerSetResponse) => {
    setSelectedStickerSet(updated);

    setOfficialStickerSets((prev) =>
      prev.map((set) => (set.id === updated.id ? { ...set, ...updated } : set))
    );

    setUserStickerSets((prev) =>
      prev.map((set) => (set.id === updated.id ? { ...set, ...updated } : set))
    );
  }, []);

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

        // Сохраняем официальные и пользовательские стикерсеты отдельно
        setOfficialStickerSets(officialStickerSets.slice(0, 3));
        setUserStickerSets(userStickerSets.slice(0, 3));

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

  return (
    <Box className="page-container-full-height">
      <StixlyPageContainer className="page-container-padding-y dashboard-container">
        {isLoading ? (
          <LoadingSpinner message="Загрузка статистики..." />
        ) : stats ? (
          <>
            {/* Блок статистики */}
            <StatisticsCard
              likes={{
                value: stats.totalLikes,
                trend: stats.likesTodayTrend
              }}
              creations={{
                value: stats.totalStickerPacks,
                trend: stats.stickerPacksTrend
              }}
              artpoints={{
                value: stats.artEarnedTotal,
                trend: stats.artEarnedTrend
              }}
            />

            {/* Два блока стикерсетов рядом */}
            <Box
              sx={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              {officialStickerSets.length > 0 && (
                <StickersCarousel
                  title="Top official Stickers"
                  stickerSets={officialStickerSets}
                  onPackClick={handlePackClick}
                  variant="official"
                />
              )}
              
              {userStickerSets.length > 0 && (
                <StickersCarousel
                  title="Top custom Stickers"
                  stickerSets={userStickerSets}
                  onPackClick={handlePackClick}
                  variant="custom"
                />
              )}
            </Box>

            {/* Daily Activity - должен быть ПЕРЕД Top Users по дизайну Figma */}
            <DailyActivity
              onCheckAll={() => {
                // TODO: Реализовать при добавлении API
                console.log('Check all activity clicked');
              }}
            />

            {/* Топ пользователей */}
            <Box sx={{ marginBottom: '24px' }}>
              {topAuthors.length > 0 ? (
                <TopUsers authors={topAuthors.slice(0, 3)} />
              ) : (
                <Card className={cn('card-base', 'dashboard-top-users-card')}>
                  <CardContent className="dashboard-top-users-card-content">
                    <Typography
                      variant="body2"
                      className="dashboard-top-users-title"
                    >
                      Top users
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
            </Box>

            {/* Топ авторов */}
            <Box sx={{ marginBottom: '24px' }}>
              {topAuthorsList.length > 0 ? (
                <TopAuthors authors={topAuthorsList.slice(0, 3)} />
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
                      Top Authors
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
            </Box>

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
