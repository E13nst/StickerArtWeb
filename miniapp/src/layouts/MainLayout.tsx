import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { BottomNav } from '@/components/BottomNav';
import { useTelegram } from '@/hooks/useTelegram';
import { useHeaderColor } from '@/hooks/useHeaderColor';

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  const location = useLocation();
  const isProfilePage = location.pathname.startsWith('/profile');
  const isAuthorPage = location.pathname.startsWith('/author');
  const isDashboardPage = location.pathname === '/' || location.pathname.startsWith('/dashboard');
  const { updateHeaderColor } = useTelegram();
  const [currentSlideBg, setCurrentSlideBg] = useState<string | undefined>();
  
  // Используем хук для определения цвета header
  const headerColor = useHeaderColor({
    currentSlideBg,
    onColorChange: (color) => {
      if (updateHeaderColor) {
        updateHeaderColor(color);
      }
    }
  });

  // Обновляем цвет header при изменении
  useEffect(() => {
    if (updateHeaderColor && headerColor) {
      updateHeaderColor(headerColor);
    }
  }, [headerColor, updateHeaderColor]);
  
  return (
    <div className="stixly-main-layout" style={{ position: 'relative', minHeight: '100vh' }}>
      {!isProfilePage && !isAuthorPage && (
        <StixlyTopHeader
          onSlideChange={setCurrentSlideBg}
          fixedSlideId={isDashboardPage ? 2 : undefined}
          showThemeToggle={false}
        />
      )}
      <div style={{ 
        paddingBottom: 'calc(100vh * 0.062 + 100vh * 0.024 + 24px)' // высота навигации + отступ снизу + дополнительное пространство
      }}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}


