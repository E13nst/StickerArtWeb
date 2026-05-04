import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { HeaderPanel } from '@/components/ui/HeaderPanel';
import { BottomNav } from '@/components/BottomNav';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DebugPanel } from '@/components/DebugPanel';
import { useTelegram } from '@/hooks/useTelegram';
import { ScrollProvider } from '@/contexts/ScrollContext';
import { isDevToolsUnlocked, persistDevToolsUnlocked } from '@/utils/devToolsUnlock';
import { useGenerateLandingGateStore } from '@/store/useGenerateLandingGateStore';
import './MainLayout.css';

interface Props {
  children: ReactNode;
}

const scrollStorageKey = (pathname: string, search: string) =>
  `stixly.mainScroll:${pathname}${search}`;

export default function MainLayout({ children }: Props) {
  const location = useLocation();
  const pathname = location.pathname;
  const isSwipePage = pathname.startsWith('/nft-soon');
  const hideHeaderPanel = pathname === '/profile' || pathname.startsWith('/author/');
  const { isReady, initData } = useTelegram();
  const landingReleased = useGenerateLandingGateStore((s) => s.isReleased);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  /** Инкремент при разблокировке — перечитываем sessionStorage; закрытие debug-панели на это не влияет. */
  const [devToolsUnlockTick, setDevToolsUnlockTick] = useState(0);

  const navVariant = useMemo((): 'minimal' | 'full' => (isDevToolsUnlocked() ? 'full' : 'minimal'), [devToolsUnlockTick]);
  const viewportHeightCss = 'var(--stixly-viewport-height, var(--tg-viewport-height, var(--tg-viewport-stable-height, 100vh)))';

  useEffect(() => {
    const onUnlock = () => {
      persistDevToolsUnlocked();
      setDevToolsUnlockTick((t) => t + 1);
    };
    window.addEventListener('stixly-open-debug-panel', onUnlock);
    return () => window.removeEventListener('stixly-open-debug-panel', onUnlock);
  }, []);

  /** Сохраняем позицию скролла по маршруту — без принудительного сброса в 0 при каждом переходе. */
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const key = scrollStorageKey(pathname, location.search);
    let tid: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(tid);
      tid = setTimeout(() => {
        try {
          sessionStorage.setItem(key, String(el.scrollTop));
        } catch {
          /* quota / private mode */
        }
      }, 100);
    };
    el.addEventListener('scroll', save, { passive: true });
    return () => {
      clearTimeout(tid);
      el.removeEventListener('scroll', save);
    };
  }, [pathname, location.search]);

  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const key = scrollStorageKey(pathname, location.search);
    try {
      const raw = sessionStorage.getItem(key);
      const top = raw != null ? Number(raw) : 0;
      el.scrollTop = Number.isFinite(top) && top >= 0 ? top : 0;
    } catch {
      el.scrollTop = 0;
    }
  }, [pathname, location.search]);

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

  // Снятие / сброс гейта только по pathname (не в GeneratePage.mount — иначе React Strict Mode снова сбрасывает overlay после release()).
  useLayoutEffect(() => {
    const { reset, release } = useGenerateLandingGateStore.getState();
    if (pathname === '/generate') {
      reset();
    } else {
      release();
    }
  }, [pathname]);

  /** Контент рисуется как обычно; один слой сверху перекрывает и уезжает при готовности. */
  const holdBootOverlay = !isReady || (pathname === '/generate' && !landingReleased);

  const [bootLayerMounted, setBootLayerMounted] = useState(holdBootOverlay);
  const [bootLayerLeaving, setBootLayerLeaving] = useState(false);

  const leaveTransitionDoneRef = useRef(false);

  useLayoutEffect(() => {
    if (holdBootOverlay) {
      leaveTransitionDoneRef.current = false;
      setBootLayerMounted(true);
      setBootLayerLeaving(false);
      return;
    }
    if (bootLayerMounted) {
      setBootLayerLeaving(true);
    }
  }, [holdBootOverlay, bootLayerMounted]);

  const handleBootOverlayTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (!bootLayerLeaving || holdBootOverlay) return;
    if (e.propertyName !== 'opacity' && e.propertyName !== 'transform') return;
    if (leaveTransitionDoneRef.current) return;
    leaveTransitionDoneRef.current = true;
    setBootLayerMounted(false);
    setBootLayerLeaving(false);
  };

  return (
    <>
    <div
      className="stixly-main-layout"
      style={{
        position: 'relative',
        /* Ровно один экран: иначе высота скролла (100dvh − низ) + шапка в потоке > вьюпорт — полосы и артефакты */
        minHeight: viewportHeightCss,
        height: viewportHeightCss,
        maxHeight: viewportHeightCss,
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: 'hidden',
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
            flex: '1 1 0%',
            minHeight: 0,
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
      <BottomNav variant={navVariant} />
    </div>
    {bootLayerMounted && (
      <div
        className={`stixly-boot-overlay${bootLayerLeaving ? ' stixly-boot-overlay--leave' : ''}`}
        aria-live="polite"
        aria-busy={!bootLayerLeaving}
        style={{ minHeight: viewportHeightCss }}
        onTransitionEnd={handleBootOverlayTransitionEnd}
      >
        <LoadingSpinner message="" size={72} />
      </div>
    )}
    </>
  );
}


