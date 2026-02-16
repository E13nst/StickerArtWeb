import { useCallback, useEffect, useMemo, useState, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/hooks/useTelegram';
import { useStickerStore } from '@/store/useStickerStore';
import { useLikesStore } from '@/store/useLikesStore';
import { useProfileStore } from '@/store/useProfileStore';
import { apiClient } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TopUsers } from '@/components/TopUsers';
import { TopAuthors } from '@/components/TopAuthors';
import { PackCard } from '@/components/PackCard';
import { StickerPackModal } from '@/components/StickerPackModal';
import { Text } from '@/components/ui/Text';
import { StickerSetResponse, LeaderboardUser, LeaderboardAuthor } from '@/types/sticker';
import { adaptStickerSetsToGalleryPacks } from '@/utils/galleryAdapter';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
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

export const DashboardPage: FC = () => {
  const MAX_TOP_STICKERS = 10;
  const navigate = useNavigate();
  const { isInTelegramApp } = useTelegram();
  const { totalElements, stickerSets } = useStickerStore();
  const { likes } = useLikesStore();
  const { userInfo } = useProfileStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
  const officialPacks = useMemo(
    () => adaptStickerSetsToGalleryPacks(topStickersByCategory.official ?? []).slice(0, 3),
    [topStickersByCategory.official]
  );
  const userPacks = useMemo(
    () => adaptStickerSetsToGalleryPacks(topStickersByCategory.user ?? []).slice(0, 3),
    [topStickersByCategory.user]
  );

  const [carouselUserIndex, setCarouselUserIndex] = useState(0);
  const [carouselOfficialIndex, setCarouselOfficialIndex] = useState(0);
  const [userTrackNoTransition, setUserTrackNoTransition] = useState(false);
  const [officialTrackNoTransition, setOfficialTrackNoTransition] = useState(false);

  const CAROUSEL_TRANSITION_MS = 450;

  useEffect(() => {
    if (userPacks.length <= 1) return;
    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 1500;
      return setTimeout(() => {
        setCarouselUserIndex((i) => (i < userPacks.length ? i + 1 : 0));
        timeoutRef = scheduleNext();
      }, delay);
    };
    let timeoutRef = scheduleNext();
    return () => clearTimeout(timeoutRef);
  }, [userPacks.length]);

  useEffect(() => {
    if (officialPacks.length <= 1) return;
    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 1500;
      return setTimeout(() => {
        setCarouselOfficialIndex((i) => (i < officialPacks.length ? i + 1 : 0));
        timeoutRef = scheduleNext();
      }, delay);
    };
    let timeoutRef = scheduleNext();
    return () => clearTimeout(timeoutRef);
  }, [officialPacks.length]);

  useEffect(() => {
    if (userPacks.length <= 1) return;
    if (carouselUserIndex !== userPacks.length) return;
    const t = setTimeout(() => {
      setUserTrackNoTransition(true);
      setCarouselUserIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setUserTrackNoTransition(false);
        });
      });
    }, CAROUSEL_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [carouselUserIndex, userPacks.length]);

  useEffect(() => {
    if (officialPacks.length <= 1) return;
    if (carouselOfficialIndex !== officialPacks.length) return;
    const t = setTimeout(() => {
      setOfficialTrackNoTransition(true);
      setCarouselOfficialIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOfficialTrackNoTransition(false);
        });
      });
    }, CAROUSEL_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [carouselOfficialIndex, officialPacks.length]);

  const handlePackClick = (packId: string) => {
    const fromOfficial = topStickersByCategory.official?.find(s => s.id.toString() === packId);
    const fromUser = topStickersByCategory.user?.find(s => s.id.toString() === packId);
    const stickerSet = fromOfficial ?? fromUser;
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setIsModalOpen(true);
    }
  };

  const handleStickerSetUpdated = useCallback((updated: StickerSetResponse) => {
    setSelectedStickerSet(updated);

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

        // ART — из API /statistics (art.earned.total, art.total, art.balance; art.earned.daily, art.daily)
        let artEarnedTotal = 0;
        let artEarnedTrend = '+0';
        try {
          const statisticsResponse = await apiClient.getStatistics();
          const res = statisticsResponse as Record<string, unknown> | undefined;
          const art = res?.art as Record<string, unknown> | undefined;
          const artEarned = art?.earned as Record<string, unknown> | undefined;
          const toNum = (v: unknown): number | null => {
            if (typeof v === 'number' && Number.isFinite(v)) return v;
            if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : null; }
            return null;
          };
          const total = toNum(artEarned?.total) ?? toNum(art?.total) ?? toNum(art?.balance);
          const daily = toNum(artEarned?.daily) ?? toNum(art?.daily);
          if (total !== null) artEarnedTotal = total;
          if (daily !== null && daily > 0) artEarnedTrend = `+${daily % 1 === 0 ? daily : daily.toFixed(1)}`;
        } catch (e) {
          console.warn('⚠️ Не удалось загрузить статистику ART с /api/statistics:', e);
        }

        // Расчет трендов за день/сегодня
        // Для стикерпаков: предполагаем рост ~2% в день
        const packsPerDay = Math.floor(totalStickerPacksInBase * 0.02);
        const stickerPacksTrend = packsPerDay > 0 ? `+${packsPerDay}` : '+0';
        
        // Для лайков за сегодня: предполагаем ~5% от общего количества
        const likesToday = Math.floor(totalLikesOnPlatform * 0.05);
        const likesTodayTrend = likesToday > 0 ? `+${likesToday}` : '+0';

        setStats({
          totalStickerPacks: totalStickerPacksInBase,
          stickerPacksTrend,
          totalLikes: totalLikesOnPlatform,
          likesTodayTrend,
          artEarnedTotal,
          artEarnedTrend
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

  return (
    <div className={cn('page-container', 'dashboard-page', 'account-page', 'page-container-full-height', isInTelegramApp && 'telegram-app')}>
      <OtherAccountBackground />
      <StixlyPageContainer className="dashboard-container">
        {isLoading ? (
          <LoadingSpinner message="Загрузка статистики..." />
        ) : stats ? (
          <>
            {/* Statistics Section — Figma Our Statistics */}
            <div className="dashboard-stats-section-wrap">
            <div className="dashboard-stats-section">
              <h2 className="dashboard-stats-title">Our Statistics</h2>
              <div className="dashboard-stats-content">
                <div className="dashboard-stat-item">
                  <span className="dashboard-stat-label">Likes</span>
                  <div className="dashboard-stat-value-row">
                    <span className="dashboard-stat-value">{stats.totalLikes}</span>
                    <span className="dashboard-stat-trend">{stats.likesTodayTrend}</span>
                  </div>
                </div>
                <div className="dashboard-stat-item">
                  <span className="dashboard-stat-label">Сreations</span>
                  <div className="dashboard-stat-value-row">
                    <span className="dashboard-stat-value">{stats.totalStickerPacks}</span>
                    <span className="dashboard-stat-trend">{stats.stickerPacksTrend}</span>
                  </div>
                </div>
                <div className="dashboard-stat-item">
                  <span className="dashboard-stat-label">Artpoints</span>
                  <div className="dashboard-stat-value-row">
                    <span className="dashboard-stat-value">
                      {stats.artEarnedTotal.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 1,
                      })}
                    </span>
                    <span className="dashboard-stat-trend">{stats.artEarnedTrend}</span>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Top Stickers: Card Custom + Card Official — одна pack card, слайд-карусель */}
            <div className="dashboard-category-section">
              <div className="dashboard-category-cards-row">
                <div className="dashboard-card dashboard-card-custom">
                  <h2 className="dashboard-card-title">Top custom Stickers</h2>
                  <div className="dashboard-card-carousel">
                    <div
                      className={cn('dashboard-card-carousel-track', userTrackNoTransition && 'dashboard-card-carousel-track--no-transition')}
                      style={{
                        transform: `translateX(-${carouselUserIndex * 209}px)`,
                      }}
                    >
                      {userPacks.map((pack) => (
                        <div key={pack.id} className="dashboard-card-carousel-slide">
                          <PackCard pack={pack} onClick={handlePackClick} />
                        </div>
                      ))}
                      {userPacks.length > 1 && userPacks[0] && (
                        <div className="dashboard-card-carousel-slide" aria-hidden>
                          <PackCard pack={userPacks[0]} onClick={handlePackClick} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="dashboard-card dashboard-card-official">
                  <h2 className="dashboard-card-title">Top official Stickers</h2>
                  <div className="dashboard-card-carousel">
                    <div
                      className={cn('dashboard-card-carousel-track', officialTrackNoTransition && 'dashboard-card-carousel-track--no-transition')}
                      style={{
                        transform: `translateX(-${carouselOfficialIndex * 209}px)`,
                      }}
                    >
                      {officialPacks.map((pack) => (
                        <div key={pack.id} className="dashboard-card-carousel-slide">
                          <PackCard pack={pack} onClick={handlePackClick} />
                        </div>
                      ))}
                      {officialPacks.length > 1 && officialPacks[0] && (
                        <div className="dashboard-card-carousel-slide" aria-hidden>
                          <PackCard pack={officialPacks[0]} onClick={handlePackClick} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily activity — Figma */}
            <div className="dashboard-daily-activity-section">
            <div className="dashboard-daily-activity">
              <h2 className="dashboard-daily-activity-title">Daily activity</h2>
              <div className="dashboard-daily-activity-carousel">
                <div className="dashboard-daily-activity-pool">
                  <div className="dashboard-daily-activity-task">
                    <div className="dashboard-daily-activity-task__ico" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="dashboard-daily-activity-task__ico-svg">
                        <path d="M14 10H6M10 14l-4-4 4-4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="dashboard-daily-activity-task__info">
                      <span className="dashboard-daily-activity-task__title">Swipe 50 cards</span>
                      <span className="dashboard-daily-activity-task__reward">1,000 ART</span>
                    </div>
                    <button type="button" className="dashboard-daily-activity-task__btn">
                      Start
                    </button>
                  </div>
                  <div className="dashboard-daily-activity-task">
                    <div className="dashboard-daily-activity-task__ico" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="dashboard-daily-activity-task__ico-svg">
                        <rect x="2" y="2" width="6" height="6" rx="1" stroke="#FFFFFF" strokeWidth="1.25"/>
                        <rect x="12" y="2" width="6" height="6" rx="1" stroke="#FFFFFF" strokeWidth="1.25"/>
                        <rect x="2" y="12" width="6" height="6" rx="1" stroke="#FFFFFF" strokeWidth="1.25"/>
                        <rect x="12" y="12" width="6" height="6" rx="1" stroke="#FFFFFF" strokeWidth="1.25"/>
                      </svg>
                    </div>
                    <div className="dashboard-daily-activity-task__info">
                      <span className="dashboard-daily-activity-task__title">Create 5 stickers</span>
                      <span className="dashboard-daily-activity-task__reward">100 ART</span>
                    </div>
                    <button type="button" className="dashboard-daily-activity-task__btn dashboard-daily-activity-task__btn--calm">
                      Calm
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="dashboard-daily-activity-check-all"
                onClick={() => navigate('/profile?tab=artpoints')}
              >
                CHECK ALL ACTIVITY
              </button>
            </div>
            </div>

            {/* Quick Actions */}
            {quickActions.length > 0 && (
              <div className="dashboard-quick-actions-container">
                <div className="dashboard-quick-actions-background" />
                <div className="dashboard-quick-actions-content">
                  <div className="dashboard-quick-actions-grid">
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
                  </div>
                </div>
              </div>
            )}

            {/* Top Users Section */}
            <div className="dashboard-top-users-section">
              {topAuthors.length > 0 ? (
                <TopUsers authors={topAuthors} />
              ) : (
                <div className={cn('card-base', 'dashboard-top-users-card')}>
                  <div className="dashboard-top-users-card-content">
                    <Text variant="bodySmall" color="hint" className="dashboard-top-users-title">
                      Топ пользователей
                    </Text>
                    <Text variant="bodySmall" color="hint" className="dashboard-top-users-text">
                      Загрузка...
                    </Text>
                  </div>
                </div>
              )}
            </div>

            {/* Top Authors Section */}
            <div className="dashboard-top-authors-section">
              {topAuthorsList.length > 0 ? (
                <TopAuthors authors={topAuthorsList} />
              ) : (
                <div className="card-base dashboard-top-authors-card">
                  <div className="dashboard-top-authors-card-content">
                    <Text variant="bodySmall" color="hint" className="dashboard-top-authors-title">
                      Топ авторов стикерсетов
                    </Text>
                    <Text variant="bodySmall" color="hint" className="dashboard-top-authors-text">
                      Загрузка...
                    </Text>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Spacing */}
            <div className="dashboard-bottom-spacing" />
          </>
        ) : (
          <div className={cn('flex-center', 'error-text-container')}>
            <Text variant="body" className="error-text">
              Не удалось загрузить статистику
            </Text>
          </div>
        )}
      </StixlyPageContainer>

      {/* Sticker Pack Modal */}
      <StickerPackModal
        open={isModalOpen}
        stickerSet={selectedStickerSet}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStickerSet(null);
        }}
        onLike={(id) => {
          useLikesStore.getState().toggleLike(String(id));
        }}
        onStickerSetUpdated={handleStickerSetUpdated}
      />
    </div>
  );
};
