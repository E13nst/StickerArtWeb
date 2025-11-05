import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GalleryPage } from '@/pages/GalleryPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MyProfilePage } from '@/pages/MyProfilePage';
import { DashboardPage } from '@/pages/DashboardPage';
import MainLayout from '@/layouts/MainLayout';
import { useLikesStore } from '@/store/useLikesStore';

const App: React.FC = () => {
  const { clearStorage } = useLikesStore();

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

  return (
    <Router basename="/miniapp">
      <MainLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/profile" element={<MyProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          {/* Fallback route */}
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </MainLayout>
    </Router>
  );
};

export default App;
