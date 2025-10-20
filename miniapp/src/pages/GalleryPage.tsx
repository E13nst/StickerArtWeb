import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useStickerStore } from '../store/useStickerStore';
import { apiClient } from '../api/client';
import { StickerSetResponse } from '../types/sticker';
import { getStickerThumbnailUrl } from '../utils/stickerUtils';

// Новые Telegram-style компоненты
import { TelegramLayout } from '../components/TelegramLayout';
import { TelegramStickerCard } from '../components/TelegramStickerCard';
import { AnimatedSticker } from '../components/AnimatedSticker';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { EmptyState } from '../components/EmptyState';
import { DebugPanel } from '../components/DebugPanel';
import { StickerPackModal } from '../components/StickerPackModal';

// Новые компоненты галереи
import { GalleryGrid } from '../components/GalleryGrid';
import { adaptStickerSetsToGalleryPacks } from '../utils/galleryAdapter';

export const GalleryPage: React.FC = () => {
  const { tg, user, initData, isReady, isInTelegramApp, isMockMode, checkInitDataExpiry } = useTelegram();
  const {
    isLoading,
    isAuthLoading,
    stickerSets,
    error,
    setLoading,
    setAuthLoading,
    setStickerSets,
    setAuthStatus,
    setError,
    setAuthError,
  } = useStickerStore();

  // Локальное состояние
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [manualInitData, setManualInitData] = useState<string>('');
  const [useNewGallery, setUseNewGallery] = useState(true); // Переключатель для нового вида

  // Загрузка initData из URL параметров при инициализации
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlInitData = urlParams.get('initData');
    const storedInitData = localStorage.getItem('telegram_init_data');
    const extensionInitData = apiClient.checkExtensionHeaders();
    
    if (urlInitData) {
      setManualInitData(decodeURIComponent(urlInitData));
      localStorage.setItem('telegram_init_data', decodeURIComponent(urlInitData));
    } else if (storedInitData) {
      setManualInitData(storedInitData);
    } else if (extensionInitData) {
      // initData уже установлен
    }
  }, []);

  // Проверка авторизации
  const checkAuth = useCallback(async () => {
    const currentInitData = manualInitData || initData;

    if (!isInTelegramApp && !manualInitData && !currentInitData) {
      console.log('✅ Режим без авторизации (dev mode)');
      setAuthStatus({
        authenticated: true,
        role: 'public'
      });
      return true;
    }
    
    if (!currentInitData) {
      console.log('⚠️ initData отсутствует');
      setAuthStatus({
        authenticated: false,
        role: 'anonymous'
      });
      return false;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const isTestData = currentInitData.includes('query_id=test');
      if (!isTestData) {
        const initDataCheck = checkInitDataExpiry(currentInitData);
        if (!initDataCheck.valid) {
          throw new Error(initDataCheck.reason);
        }
      }

      apiClient.setAuthHeaders(currentInitData);
      const authResponse = await apiClient.checkAuthStatus();
      setAuthStatus(authResponse);

      if (!authResponse.authenticated) {
        throw new Error(authResponse.message || 'Ошибка авторизации');
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setAuthError(errorMessage);
      console.error('❌ Ошибка авторизации:', error);
      
      // В dev режиме или если API недоступен - продолжаем работу
      if (isMockMode || !isInTelegramApp) {
        console.log('🔧 Продолжаем в dev режиме несмотря на ошибку API');
        setAuthStatus({
          authenticated: true,
          role: 'public'
        });
        return true;
      }
      
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [manualInitData, initData, isInTelegramApp, isMockMode, checkInitDataExpiry]);

  // Загрузка стикерсетов
  const fetchStickerSets = async (page: number = 0) => {
    setLoading(true);
    setError(null);

    try {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated && isInTelegramApp && !isMockMode) {
        throw new Error('Пользователь не авторизован');
      }

      const response = await apiClient.getStickerSets(page);
      setStickerSets(response.content || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки стикеров';
      
      // В dev режиме показываем ошибку, но не блокируем интерфейс
      if (isMockMode || !isInTelegramApp) {
        console.warn('⚠️ API недоступен, показываем пустое состояние:', errorMessage);
        setStickerSets([]); // Пустой массив вместо ошибки
      } else {
        setError(errorMessage);
      }
      
      console.error('❌ Ошибка загрузки стикеров:', error);
    } finally {
      setLoading(false);
    }
  };

  // Поиск стикерсетов
  const searchStickerSets = async (query: string) => {
    if (!query.trim()) {
      fetchStickerSets();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.searchStickerSets(query);
      setStickerSets(response.content || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка поиска стикеров';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Обработчики
  const handleViewStickerSet = (id: number | string) => {
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
    
    const stickerSet = stickerSets.find(s => s.id.toString() === id.toString());
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setDetailOpen(true);
    }
  };

  const handleBackToList = () => {
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    setDetailOpen(false);
    setSelectedStickerSet(null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    
    const delayedSearch = setTimeout(() => {
      searchStickerSets(newSearchTerm);
    }, 500);

    return () => clearTimeout(delayedSearch);
  };

  // Фильтрация
  const filteredStickerSets = useMemo(() => 
    stickerSets.filter(stickerSet =>
      stickerSet.title.toLowerCase().includes(searchTerm.toLowerCase())
    ), [stickerSets, searchTerm]
  );

  // Мемоизация адаптированных данных для галереи
  const galleryPacks = useMemo(() => 
    adaptStickerSetsToGalleryPacks(filteredStickerSets), 
    [filteredStickerSets]
  );

  // Инициализация
  useEffect(() => {
    if (isReady) {
      fetchStickerSets();
    }
  }, [isReady, manualInitData]);

  if (!isReady) {
    return <LoadingSpinner message="Инициализация..." />;
  }

  // Детальная модалка поверх списка

  return (
    <>
      <TelegramLayout>
        {/* User Info Badge */}
        {user && (
          <div className="tg-user-badge fade-in">
            <div className="tg-user-badge__avatar">
              {user.first_name.charAt(0)}
            </div>
            <div className="tg-user-badge__info">
              <div className="tg-user-badge__name">
                {user.first_name} {user.last_name || ''}
              </div>
              {user.username && (
                <div className="tg-user-badge__username">@{user.username}</div>
              )}
            </div>
            {isMockMode && (
              <div className="tg-user-badge__mock-badge">DEV</div>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="tg-search fade-in">
          <input
            type="text"
            className="tg-search__input"
            placeholder="🔍 Поиск стикеров..."
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={isLoading}
          />
        </div>

        {/* Переключатель вида галереи */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '16px',
          padding: '0 16px'
        }}>
          <button
            onClick={() => setUseNewGallery(true)}
            style={{
              padding: '8px 16px',
              background: useNewGallery ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
              color: useNewGallery ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
              border: 'none',
              borderRadius: 'var(--tg-radius-m)',
              fontSize: 'var(--tg-font-size-s)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            🎨 Новая галерея
          </button>
          <button
            onClick={() => setUseNewGallery(false)}
            style={{
              padding: '8px 16px',
              background: !useNewGallery ? 'var(--tg-theme-button-color)' : 'var(--tg-theme-secondary-bg-color)',
              color: !useNewGallery ? 'var(--tg-theme-button-text-color)' : 'var(--tg-theme-text-color)',
              border: 'none',
              borderRadius: 'var(--tg-radius-m)',
              fontSize: 'var(--tg-font-size-s)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            📋 Список
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner message="Загрузка стикеров..." />
        ) : error ? (
          <ErrorDisplay error={error} onRetry={() => fetchStickerSets()} />
        ) : filteredStickerSets.length === 0 ? (
          <EmptyState
            title="🎨 Стикеры не найдены"
            message={searchTerm ? 'По вашему запросу ничего не найдено' : 'У вас пока нет созданных наборов стикеров'}
            actionLabel="Создать стикер"
            onAction={() => {
              if (tg) {
                tg.openTelegramLink('https://t.me/StickerGalleryBot');
              }
            }}
          />
        ) : useNewGallery ? (
          <div className="fade-in" style={{ height: 'calc(100vh - 200px)' }}>
            <GalleryGrid
              packs={galleryPacks}
              onPackClick={handleViewStickerSet}
              height={600}
            />
          </div>
        ) : (
          <div className="fade-in" style={{ paddingBottom: '60px' }}>
            {filteredStickerSets.map((stickerSet, index) => (
              <TelegramStickerCard
                key={stickerSet.id}
                title={stickerSet.title}
                description={`Создано: ${new Date(stickerSet.createdAt).toLocaleDateString()}`}
                stickerCount={stickerSet.telegramStickerSetInfo?.stickers.length || 0}
                previewStickers={stickerSet.telegramStickerSetInfo?.stickers.slice(0, 4).map(s => ({
                  id: s.file_id,
                  thumbnailUrl: getStickerThumbnailUrl(s.file_id),
                  emoji: s.emoji,
                  isAnimated: s.is_animated
                })) || []}
                onClick={() => handleViewStickerSet(stickerSet.id)}
                priority={index < 3 ? 'high' : 'low'}
              />
            ))}
          </div>
        )}
      </TelegramLayout>
      <DebugPanel initData={initData} />
      <StickerPackModal open={isDetailOpen} stickerSet={selectedStickerSet} onClose={handleBackToList} />
    </>
  );
};
