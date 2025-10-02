import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GalleryPage } from '@/pages/GalleryPage';
import { ProfilePage } from '@/pages/ProfilePage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<GalleryPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        {/* Fallback route */}
        <Route path="*" element={<GalleryPage />} />
      </Routes>
    </Router>
  );
};

export default App;
