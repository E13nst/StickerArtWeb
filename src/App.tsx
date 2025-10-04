import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GalleryPage } from '@/pages/GalleryPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MyProfilePage } from '@/pages/MyProfilePage';
import { BuildInfo } from '@/components/BuildInfo';

const App: React.FC = () => {
  return (
    <Router>
      <BuildInfo showInConsole={true} showInUI={process.env.NODE_ENV === 'development'} />
      <Routes>
        <Route path="/" element={<GalleryPage />} />
        <Route path="/profile" element={<MyProfilePage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        {/* Fallback route */}
        <Route path="*" element={<GalleryPage />} />
      </Routes>
    </Router>
  );
};

export default App;
