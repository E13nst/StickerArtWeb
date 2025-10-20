import React from 'react';
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { BottomNav } from '@/components/BottomNav';

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  return (
    <div className="stixly-main-layout" style={{ position: 'relative', minHeight: '100vh' }}>
      <StixlyTopHeader />
      <div>{children}</div>
      <BottomNav />
    </div>
  );
}


