import React from 'react';
import { useLocation } from 'react-router-dom';
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { BottomNav } from '@/components/BottomNav';

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  const location = useLocation();
  const isProfilePage = location.pathname.startsWith('/profile');
  
  return (
    <div className="stixly-main-layout" style={{ position: 'relative', minHeight: '100vh' }}>
      {!isProfilePage && <StixlyTopHeader />}
      <div style={{ 
        paddingBottom: 'calc(100vh * 0.062 + 100vh * 0.024 + 24px)' // высота навигации + отступ снизу + дополнительное пространство
      }}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}


