import { useEffect, lazy, Suspense, FC } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import MainLayout from '@/layouts/MainLayout';
import { useLikesStore } from '@/store/useLikesStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useTelegram } from '@/hooks/useTelegram';
import { apiClient } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
// 🔍 Импортируем animationMonitor для диагностики производительности
import '@/utils/animationMonitor';
// ✅ FIX: Импортируем для обработки ошибок blob URLs
import { videoBlobCache } from '@/utils/imageLoader';

// Lazy load страниц для code splitting
const GalleryPage = lazy(() => import('@/pages/GalleryPage2').then(m => ({ default: m.GalleryPage2 })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const MyProfilePage = lazy(() => import('@/pages/MyProfilePage').then(m => ({ default: m.MyProfilePage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AuthorPage = lazy(() => import('@/pages/AuthorPage').then(m => ({ default: m.AuthorPage })));
const SwipePage = lazy(() => import('@/pages/SwipePage').then(m => ({ default: m.SwipePage })));
const GeneratePage = lazy(() => import('@/pages/GeneratePage').then(m => ({ default: m.GeneratePage })));
const DesignSystemDemo = lazy(() => import('@/pages/DesignSystemDemo').then(m => ({ default: m.DesignSystemDemo })));

// TON Connect manifest URL (статический, так как MiniApp развёрнут на стабильном домене)
const manifestUrl = 'https://sticker-art-e13nst.amvera.io/miniapp/tonconnect-manifest.json';

const App: FC = () => {
  // ✅ FIX: Используем selector для предотвращения пересоздания функции
  const clearStorage = useLikesStore(state => state.clearStorage);
  const initializeCurrentUser = useProfileStore((state) => state.initializeCurrentUser);
  const hasMyProfileLoaded = useProfileStore((state) => state.hasMyProfileLoaded);
  const { initData, user } = useTelegram();

  // Принудительная очистка старых данных при первом запуске приложения
  useEffect(() => {
    const storageVersion = localStorage.getItem('likes-storage-version');
    const currentVersion = '2'; // Версия STORAGE_VERSION из useLikesStore
    
    // Очищаем storage если версия изменилась
    if (storageVersion !== currentVersion) {
      clearStorage();
      localStorage.setItem('likes-storage-version', currentVersion);
      console.log('🧹 Очищены старые данные о лайках из localStorage (версия обновлена)');
    }
  }, [clearStorage]);

  useEffect(() => {
    // Устанавливаем заголовки только когда есть непустой initData.
    // Иначе не перезаписываем defaults — интерцептор в client.ts возьмёт initData из getInitData() (Telegram.WebApp, URL, sessionStorage) на каждый запрос.
    const currentInitData = (initData || '').trim();
    if (!currentInitData) {
      return;
    }

    apiClient.setAuthHeaders(currentInitData, user?.language_code);

    if (import.meta.env.DEV) {
      const hasQueryId = currentInitData.includes('query_id=');
      const hasChat = currentInitData.includes('chat=') || currentInitData.includes('chat_type=');
      const hasUser = currentInitData.includes('user=');
      const context = hasQueryId && !hasChat ? 'INLINE_QUERY' : hasChat ? 'CHAT' : 'UNKNOWN';
      console.log('🔐 App.tsx: Установка заголовков авторизации:', {
        context,
        hasQueryId,
        hasChat,
        hasUser,
        initDataLength: currentInitData.length,
        hasUserObject: Boolean(user),
        language: user?.language_code
      });
      if (hasQueryId && !hasChat && hasUser) {
        console.log('✅ Inline query контекст подтвержден: initData содержит user + query_id без chat');
      }
    }
  }, [initData, user?.language_code]);

  useEffect(() => {
    if (!initData || hasMyProfileLoaded) {
      return;
    }

    initializeCurrentUser(user?.id ?? null).catch(() => undefined);
  }, [initData, user?.id, hasMyProfileLoaded, initializeCurrentUser]);

  // ✅ FIX: Глобальная обработка ошибок загрузки blob URLs
  useEffect(() => {
    const handleBlobError = (event: ErrorEvent) => {
      const target = event.target;
      if (target && (target instanceof HTMLVideoElement || target instanceof HTMLImageElement)) {
        const src = target.src;
        if (src && src.startsWith('blob:')) {
          // Извлекаем fileId из атрибута data-file-id или из других источников
          const fileId = (target as any).dataset?.fileId || 
                        (target as any).getAttribute('data-file-id') ||
                        src.split('/').pop()?.split('-').slice(0, 4).join('-');
          
          if (fileId) {
            console.warn(`[App] Invalid blob URL detected for ${fileId}, removing from cache`);
            // Удаляем недействительный blob URL из кеша
            videoBlobCache.delete(fileId).catch(() => {});
            // Пытаемся найти оригинальный URL и перезагрузить
            // Это будет обработано компонентами через их обработчики onError
          }
        }
      }
    };

    // Обрабатываем ошибки загрузки ресурсов
    window.addEventListener('error', handleBlobError, true);
    
    return () => {
      window.removeEventListener('error', handleBlobError, true);
    };
  }, []);

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <Router basename="/miniapp" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MainLayout>
          <Suspense fallback={
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '60vh' 
            }}>
              <LoadingSpinner />
            </div>
          }>
          <Routes>
            <Route path="/" element={<Navigate to="/gallery" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/profile" element={<MyProfilePage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/author/:id" element={<AuthorPage />} />
            <Route path="/nft-soon" element={<SwipePage />} />
            <Route path="/generate" element={<GeneratePage />} />
            <Route path="/design-system-demo" element={<DesignSystemDemo />} />
            {/* Fallback route */}
            <Route path="*" element={<DashboardPage />} />
          </Routes>
          </Suspense>
        </MainLayout>
      </Router>
    </TonConnectUIProvider>
  );
};

export default App;
