import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import StixlyTopHeader from '@/components/StixlyTopHeader';
import { BottomNav } from '@/components/BottomNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useTelegram } from '@/hooks/useTelegram';
import { useHeaderColor } from '@/hooks/useHeaderColor';
import { ScrollProvider } from '@/contexts/ScrollContext';

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  const location = useLocation();
  const isProfilePage = location.pathname.startsWith('/profile');
  const isAuthorPage = location.pathname.startsWith('/author');
  const isDashboardPage = location.pathname === '/' || location.pathname.startsWith('/dashboard');
  const isNftSoonPage = location.pathname.startsWith('/nft-soon');
  const { updateHeaderColor, isReady } = useTelegram();
  const [currentSlideBg, setCurrentSlideBg] = useState<string | undefined>();
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const isHeaderVisible = !isProfilePage && !isAuthorPage;
  
  // Используем хук для определения цвета header
  // onColorChange уже вызывает updateHeaderColor, поэтому не нужно дублировать в useEffect
  const headerColor = useHeaderColor({
    currentSlideBg,
    onColorChange: updateHeaderColor || undefined
  });

  // Сброс scroll позиции при навигации между страницами с header
  useEffect(() => {
    if (mainScrollRef.current && isHeaderVisible) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [location.pathname, isHeaderVisible]);
  
  // Не рендерим layout до стабильного viewport
  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--tg-theme-bg-color, #ffffff)'
      }}>
        <LoadingSpinner message="Инициализация..." />
      </div>
    );
  }

  return (
    <div
      className="stixly-main-layout"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: isNftSoonPage ? 'hidden' : 'visible',
        // Гарантируем, что header не обрезается этим контейнером
        overflowX: 'hidden',
        overflowY: 'visible'
      }}
    >
      {isHeaderVisible && (
        <StixlyTopHeader
          onSlideChange={setCurrentSlideBg}
          fixedSlideId={isDashboardPage ? 2 : undefined}
        />
      )}
      <ScrollProvider scrollElement={mainScrollRef.current}>
        <div
          ref={mainScrollRef}
          className="stixly-main-scroll"
          style={{
            flex: '1 1 auto',
            height: isNftSoonPage ? '100vh' : 'calc(100vh - var(--stixly-bottom-nav-height, 0px))',
            overflowY: isNftSoonPage ? 'hidden' : 'auto',
            overflowX: 'hidden',
            paddingBottom: isNftSoonPage
              ? 0
              : 'calc(100vh * 0.062 + 100vh * 0.024 + 24px)', // высота навигации + отступ снизу + дополнительное пространство
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </ScrollProvider>
      <BottomNav />
    </div>
  );
}


