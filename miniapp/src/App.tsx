import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useLikesStore } from '@/store/useLikesStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useTelegram } from '@/hooks/useTelegram';
import { apiClient } from '@/api/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load страниц для code splitting
const GalleryPage = lazy(() => import('@/pages/GalleryPage').then(m => ({ default: m.GalleryPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const MyProfilePage = lazy(() => import('@/pages/MyProfilePage').then(m => ({ default: m.MyProfilePage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AuthorPage = lazy(() => import('@/pages/AuthorPage').then(m => ({ default: m.AuthorPage })));
const NftSoonPage = lazy(() => import('@/pages/NftSoonPage').then(m => ({ default: m.NftSoonPage })));

const App: React.FC = () => {
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
    if (!initData) {
      return;
    }

    apiClient.setAuthHeaders(initData, user?.language_code);
  }, [initData, user?.language_code]);

  useEffect(() => {
    if (!initData || hasMyProfileLoaded) {
      return;
    }

    initializeCurrentUser(user?.id ?? null).catch(() => undefined);
  }, [initData, user?.id, hasMyProfileLoaded, initializeCurrentUser]);

  return (
    <Router basename="/miniapp">
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/profile" element={<MyProfilePage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/author/:id" element={<AuthorPage />} />
            <Route path="/nft-soon" element={<NftSoonPage />} />
            {/* Fallback route */}
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </Router>
  );
};

export default App;
