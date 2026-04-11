import React, { useEffect, useMemo, useRef, useState, ReactNode, CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { HeaderPanel } from '@/components/ui/HeaderPanel';
import { BottomNav } from '@/components/BottomNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DebugPanel } from '@/components/DebugPanel';
import { useTelegram } from '@/hooks/useTelegram';
import { ScrollProvider } from '@/contexts/ScrollContext';
import { isDevToolsUnlocked, persistDevToolsUnlocked } from '@/utils/devToolsUnlock';

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  const location = useLocation();
  const pathname = location.pathname;
  const isSwipePage = pathname.startsWith('/nft-soon');
  const hideHeaderPanel = pathname === '/profile' || pathname.startsWith('/author/');
  const { isReady, initData } = useTelegram();
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  /** Инкремент при разблокировке — перечитываем sessionStorage; закрытие debug-панели на это не влияет. */
  const [devToolsUnlockTick, setDevToolsUnlockTick] = useState(0);

  const showBottomNav = useMemo(() => isDevToolsUnlocked(), [devToolsUnlockTick]);
  const viewportHeightCss = 'var(--stixly-viewport-height, var(--tg-viewport-height, var(--tg-viewport-stable-height, 100vh)))';

  useEffect(() => {
    const onUnlock = () => {
      persistDevToolsUnlocked();
      setDevToolsUnlockTick((t) => t + 1);
    };
    window.addEventListener('stixly-open-debug-panel', onUnlock);
    return () => window.removeEventListener('stixly-open-debug-panel', onUnlock);
  }, []);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    const updateViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--stixly-viewport-height', `${Math.round(nextHeight)}px`);
    };

    updateViewportHeight();

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', updateViewportHeight);
    visualViewport?.addEventListener('resize', updateViewportHeight);
    visualViewport?.addEventListener('scroll', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      visualViewport?.removeEventListener('resize', updateViewportHeight);
      visualViewport?.removeEventListener('scroll', updateViewportHeight);
    };
  }, []);

  const layoutCompactBottomStyle: CSSProperties | undefined = !showBottomNav
    ? ({
        '--stixly-bottom-nav-height': 'var(--stixly-safe-area-bottom)',
        '--stixly-taskbar-height': 'calc(var(--stixly-safe-area-bottom) + 12px)',
      } as CSSProperties)
    : undefined;

  // Не рендерим layout до стабильного viewport
  if (!isReady) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: viewportHeightCss,
        backgroundColor: 'var(--color-background)'
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
        minHeight: viewportHeightCss,
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: isSwipePage ? 'hidden' : 'visible',
        ...layoutCompactBottomStyle,
      }}
    >
      {/* Полноэкранный фон под хедером: градиент из :root, чтобы под header не было тёмного слоя body */}
      {!hideHeaderPanel && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            background: 'var(--page-dynamic-gradient), var(--page-bg-base)',
            pointerEvents: 'none',
          }}
        />
      )}
      {!hideHeaderPanel && <HeaderPanel />}
      <DebugPanel initData={initData ?? undefined} />
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
            height: isSwipePage
              ? `calc(${viewportHeightCss} - var(--stixly-header-height, 80px))`
              : `calc(${viewportHeightCss} - var(--stixly-bottom-nav-height, 0px))`,
            overflowY: isSwipePage ? 'hidden' : 'auto',
            overflowX: 'hidden',
            paddingBottom: isSwipePage ? 0 : 'var(--stixly-taskbar-height, 90.25px)', // Taskbar: Navbar + Home Indicator (Figma)
            WebkitOverflowScrolling: 'touch',
            /* Прозрачный фон: на iOS backdrop-filter хедера размывает этот слой; без сплошного #191818 под хедером виден градиент страницы (OtherAccountBackground). */
            backgroundColor: 'transparent',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </div>
      </ScrollProvider>
      <BottomNav visible={showBottomNav} />
    </div>
  );
}


