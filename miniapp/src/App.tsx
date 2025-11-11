import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GalleryPage } from '@/pages/GalleryPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MyProfilePage } from '@/pages/MyProfilePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuthorPage } from '@/pages/AuthorPage';
import MainLayout from '@/layouts/MainLayout';
import { useLikesStore } from '@/store/useLikesStore';
import { useProfileStore } from '@/store/useProfileStore';
import { NftSoonPage } from '@/pages/NftSoonPage';
import { useTelegram } from '@/hooks/useTelegram';
import { apiClient } from '@/api/client';

const App: React.FC = () => {
  const { clearStorage } = useLikesStore();
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
      </MainLayout>
    </Router>
  );
};

export default App;
