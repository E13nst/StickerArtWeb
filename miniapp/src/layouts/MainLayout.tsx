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
      <div>{children}</div>
      <BottomNav />
    </div>
  );
}


