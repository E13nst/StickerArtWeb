import React, { useEffect, useState } from 'react';
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

  const quickActions = [
    {
      label: 'Roulette',
      shadow: '0 10px 30px rgba(79, 70, 229, 0.25)',
      glow: 'rgba(79, 70, 229, 0.45)',
      minWidth: 132,
    },
    {
      label: 'AI-Tools',
      shadow: '0 10px 30px rgba(236, 72, 153, 0.25)',
      glow: 'rgba(236, 72, 153, 0.45)',
      minWidth: 148,
    },
    {
      label: 'Earn ART',
      shadow: '0 10px 30px rgba(16, 185, 129, 0.25)',
      glow: 'rgba(16, 185, 129, 0.45)',
      minWidth: 148,
    },
    {
      label: 'NFT-Stickers',
      shadow: '0 10px 30px rgba(59, 130, 246, 0.25)',
      glow: 'rgba(59, 130, 246, 0.45)',
      minWidth: 164,
    },
    {
      label: 'Deepfake',
      shadow: '0 10px 30px rgba(245, 158, 11, 0.25)',
      glow: 'rgba(245, 158, 11, 0.45)',
      minWidth: 150,
    },
    {
      label: 'Battle',
      shadow: '0 10px 30px rgba(239, 68, 68, 0.25)',
      glow: 'rgba(239, 68, 68, 0.45)',
      minWidth: 140,
    },
  ];

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

        // Получаем категории и сортируем по лайкам
        try {
          const categories = await apiClient.getCategories();
          console.log('📊 Загружено категорий:', categories.length);
          
          // Подсчитываем категории и их лайки из стикерсетов
          const categoryData = new Map<string, { count: number; likes: number }>();
          
          setsForStats.forEach(set => {
            const setLikes = likes[set.id.toString()]?.likesCount || set.likesCount || 0;
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

          // Маппинг эмодзи для категорий
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

          // Сортируем по лайкам и берем топ-5
          const topCategoriesList = Array.from(categoryData.entries())
            .map(([key, data]) => {
              const category = categories.find(c => c.key === key);
              return {
                name: category?.name || key,
                count: data.likes, // Используем лайки вместо количества
                emoji: categoryEmojis[key] || '📦'
              };
            })
            .sort((a, b) => b.count - a.count) // Сортируем по лайкам
            .slice(0, 8);

          console.log('📊 Топ категорий:', topCategoriesList);
          
          // Если категорий нет, используем заглушку
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
          // Заглушка
          setTopCategories([
            { name: 'Арт', count: 8, emoji: '🎨' },
            { name: 'Животные', count: 6, emoji: '🐱' },
            { name: 'Мемы', count: 5, emoji: '😂' },
            { name: 'Премиум', count: 3, emoji: '🌟' },
            { name: 'Любовь', count: 2, emoji: '❤️' }
          ]);
        }

        // Получаем топ-5 стикерсетов по лайкам
        try {
          // Сортируем стикерсеты по лайкам (все, не только лайкнутые)
          const sortedSets = [...setsForStats]
            .sort((a, b) => {
              const likesA = likes[a.id.toString()]?.likesCount || a.likesCount || 0;
              const likesB = likes[b.id.toString()]?.likesCount || b.likesCount || 0;
              return likesB - likesA;
            })
            .slice(0, 5);
          
          console.log('📊 Отсортировано стикерсетов для топ-5:', sortedSets.length);
          setTopStickerSets(sortedSets);
        } catch (e) {
          console.warn('Не удалось загрузить топ стикеры:', e);
          setTopStickerSets([]);
        }

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

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
      color: 'var(--tg-theme-text-color, #000000)',
      paddingBottom: 0
    }}>
      <Container maxWidth={isInTelegramApp ? "sm" : "lg"} sx={{ px: 2, py: 3 }}>
        <Box
          sx={{
            position: 'relative',
            mb: 3,
            px: 1,
            overflow: 'visible',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: '-80px -220px',
              pointerEvents: 'none',
              zIndex: 0,
              opacity: 0.75,
              filter: 'blur(60px)',
              background:
                'radial-gradient(circle at 15% 50%, rgba(79,70,229,0.28) 0%, rgba(16,18,26,0) 56%) ,\
                 radial-gradient(circle at 50% 36%, rgba(236,72,153,0.24) 0%, rgba(16,18,26,0) 62%) ,\
                 radial-gradient(circle at 78% 52%, rgba(16,185,129,0.28) 0%, rgba(16,18,26,0) 58%)',
            }}
          />
          <Box
            className="category-filter-scroller"
            sx={{
              display: 'flex',
              flexDirection: 'row',
              gap: 'calc(1rem * 0.382)',
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: 'calc(1rem * 0.382)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              maskImage: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent)',
              width: '100vw',
              marginLeft: 'calc(-50vw + 50%)',
              paddingLeft: 'clamp(16px, 6vw, 36px)',
              paddingRight: 'clamp(16px, 6vw, 36px)',
              zIndex: 1,
            }}
          >
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled
                style={{
                  flexShrink: 0,
                  minWidth: 'calc(1rem * 4.2)',
                  padding: 'calc(1rem * 0.382) calc(1rem * 0.618)',
                  borderRadius: 'calc(1rem * 0.618)',
                  border: `1px solid color-mix(in srgb, ${action.glow} 60%, rgba(255,255,255,0.12))`,
                  background: `linear-gradient(135deg, rgba(12,16,26,0.86) 0%, rgba(18,22,32,0.72) 60%)`,
                  color: '#f1f5ff',
                  fontSize: 'calc(1rem * 0.618)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'default',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'calc(1rem * 0.236)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                  backgroundBlendMode: 'soft-light',
                  opacity: 0.92,
                  filter: `drop-shadow(0 4px 16px ${action.glow})`,
                }}
              >
                {action.label}
              </button>
            ))}
          </Box>
        </Box>

        {isLoading ? (
          <LoadingSpinner message="Загрузка статистики..." />
        ) : stats ? (
          <>
            {topStickerSets.length > 0 && (
              <Box sx={{ mt: 2, mb: 3 }}>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{
                    color: 'var(--tg-theme-text-color)',
                    mb: 2,
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }}
                >
                  ТОП-5 СТИКЕРОВ
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    gap: 2,
                    pb: 2,
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--tg-theme-hint-color) transparent',
                    '&::-webkit-scrollbar': {
                      height: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'transparent',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'var(--tg-theme-hint-color)',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      background: 'var(--tg-theme-button-color)',
                    },
                  }}
                >
                  {adaptStickerSetsToGalleryPacks(topStickerSets).map((pack) => (
                    <Box
                      key={pack.id}
                      sx={{
                        flexShrink: 0,
                        width: { xs: '144px', sm: '233px' },
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
                        <PackCard
                          pack={pack}
                          onClick={(packId) => {
                            const stickerSet = topStickerSets.find(s => s.id.toString() === packId);
                            if (stickerSet) {
                              setSelectedStickerSet(stickerSet);
                              setIsModalOpen(true);
                            }
                          }}
                        />
                      </Box>
                    </Box>
                  ))}
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
                      height: '100%'
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'var(--tg-theme-hint-color)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          mb: 1.5
                        }}
                      >
                        Топ-5 авторов
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'var(--tg-theme-hint-color)',
                          fontSize: '0.75rem'
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
      />
    </Box>
  );
};
