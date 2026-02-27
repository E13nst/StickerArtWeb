import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { HeaderPanel } from '@/components/ui/HeaderPanel';
import { BottomNav } from '@/components/BottomNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useTelegram } from '@/hooks/useTelegram';
import { ScrollProvider } from '@/contexts/ScrollContext';

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  const location = useLocation();
  const pathname = location.pathname;
  const isSwipePage = pathname.startsWith('/nft-soon');
  const hideHeaderPanel = pathname === '/profile' || pathname.startsWith('/author/');
  const { isReady } = useTelegram();
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Не рендерим layout до стабильного viewport
  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--tg-theme-bg-color, #191818)'
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
        overflowX: 'hidden',
        overflowY: isSwipePage ? 'hidden' : 'visible',
      }}
    >
      {!hideHeaderPanel && <HeaderPanel />}
      <ScrollProvider scrollElement={scrollElement}>
        <div
          ref={(el) => {
            (mainScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            setScrollElement(el);
          }}
          className={`stixly-main-scroll${pathname === '/profile' ? ' stixly-main-scroll--account' : ''}`}
          style={{
            position: 'relative',
            flex: '1 1 auto',
            height: isSwipePage ? 'calc(100vh - var(--stixly-header-height, 80px))' : 'calc(100vh - var(--stixly-bottom-nav-height, 0px))',
            overflowY: isSwipePage ? 'hidden' : 'auto',
            overflowX: 'hidden',
            paddingBottom: isSwipePage ? 0 : 'var(--stixly-taskbar-height, 90.25px)', // Taskbar: Navbar + Home Indicator (Figma)
            WebkitOverflowScrolling: 'touch',
            backgroundColor: '#191818',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </div>
      </ScrollProvider>
      <BottomNav />
    </div>
  );
}


