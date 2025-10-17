import React, { useEffect, useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useStickerStore } from '../store/useStickerStore';
import { apiClient } from '../api/client';
import { StickerSetResponse } from '../types/sticker';

// Новые Telegram-style компоненты
import { TelegramLayout } from '../components/TelegramLayout';
import { TelegramStickerCard } from '../components/TelegramStickerCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { EmptyState } from '../components/EmptyState';

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
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStickerSet, setSelectedStickerSet] = useState<StickerSetResponse | null>(null);
  const [manualInitData, setManualInitData] = useState<string>('');

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
  const checkAuth = async () => {
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
  };

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
  const handleViewStickerSet = (id: number) => {
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }
    
    const stickerSet = stickerSets.find(s => s.id === id);
    if (stickerSet) {
      setSelectedStickerSet(stickerSet);
      setViewMode('detail');
    }
  };

  const handleBackToList = () => {
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    setViewMode('list');
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
  const filteredStickerSets = stickerSets.filter(stickerSet =>
    stickerSet.title.toLowerCase().includes(searchTerm.toLowerCase())
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

  if (viewMode === 'detail' && selectedStickerSet) {
    return (
      <TelegramLayout
        title={selectedStickerSet.title}
        showBackButton={true}
        onBackClick={handleBackToList}
      >
        <div className="tg-sticker-detail">
          <div className="tg-sticker-detail__grid">
            {selectedStickerSet.stickers.map((sticker) => (
              <div key={sticker.id} className="tg-sticker-detail__item">
                <img
                  src={sticker.thumbnailUrl || ''}
                  alt={sticker.emoji || ''}
                  className="tg-sticker-detail__img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </TelegramLayout>
    );
  }

  return (
    <TelegramLayout title="🎨 Галерея стикеров">
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
      ) : (
        <div className="fade-in">
          {filteredStickerSets.map((stickerSet) => (
            <TelegramStickerCard
              key={stickerSet.id}
              title={stickerSet.title}
              description={`Создано: ${new Date(stickerSet.createdAt).toLocaleDateString()}`}
              stickerCount={stickerSet.stickers.length}
              previewStickers={stickerSet.stickers.slice(0, 4).map(s => ({
                id: s.id,
                thumbnailUrl: s.thumbnailUrl,
                emoji: s.emoji,
                isAnimated: s.isAnimated
              }))}
              onClick={() => handleViewStickerSet(stickerSet.id)}
            />
          ))}
        </div>
      )}
    </TelegramLayout>
  );
};
