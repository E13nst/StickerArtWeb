import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GalleryPage } from '@/pages/GalleryPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MyProfilePage } from '@/pages/MyProfilePage';

const App: React.FC = () => {
  return (
    <>
      {/* Космический фон на уровне root */}
      <div className="space-root">
        <div className="space-stars">
          <div className="layer slow"></div>
          <div className="layer fast"></div>
        </div>
      </div>
      
      <Router>
        <Routes>
          <Route path="/" element={<GalleryPage />} />
          <Route path="/profile" element={<MyProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          {/* Fallback route */}
          <Route path="*" element={<GalleryPage />} />
        </Routes>
      </Router>
    </>
  );
};

export default App;
