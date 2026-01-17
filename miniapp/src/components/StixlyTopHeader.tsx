import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "../api/client";
import CollectionsIcon from "@mui/icons-material/Collections";
import FavoriteIcon from "@mui/icons-material/Favorite";

// Build asset path respecting Vite base (/miniapp/)
const BASE = (import.meta as any).env?.BASE_URL || "/miniapp/";
const img = (name: string) => `${BASE}assets/${name}`;

// ============ Типы для профильного режима ============
export type ProfilePattern = 'none' | 'dots' | 'grid' | 'waves' | 'diagonal';

interface ProfileModeConfig {
  enabled: true;
  backgroundColor: string;
  pattern: ProfilePattern;
  content?: React.ReactNode;
}

export interface StixlyTopHeaderProps {
  profileMode?: ProfileModeConfig | { enabled: false };
  onSlideChange?: (slideBg: string) => void;
  fixedSlideId?: number;
  bottomContent?: React.ReactNode; // Дополнительный контент внизу header (например, панель поиска)
}

type Slide = {
  id: number;
  bg: string;
  img: string;
  text: string;
};

const RAW_SLIDES: (Omit<Slide, "img"> & { img: string })[] = [
  {
    id: 1,
    bg: "linear-gradient(180deg, #1D4ED8 0%, #38BDF8 100%)",
    img: "stixly-logo-orange.webp",
    text: "",
  },
  {
    id: 2,
    bg: "linear-gradient(180deg, #1D4ED8 0%, #38BDF8 100%)",
    img: "stixly-logo-orange.webp",
    text: "",
  },
];

const RU_NUMBER_FORMATTER = new Intl.NumberFormat('ru-RU');
const RU_NUMBER_FORMATTER_WITH_DECIMALS = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// ============ Генератор SVG паттернов ============
const getPatternSVG = (pattern: ProfilePattern, color: string = 'rgba(255,255,255,0.1)'): string => {
  switch (pattern) {
    case 'dots':
      return `data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='2' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E`;
    
    case 'grid':
      return `data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v1H0zM0 0v40h1V0z' fill='${encodeURIComponent(color)}'/%3E%3C/svg%3E`;
    
    case 'waves':
      return `data:image/svg+xml,%3Csvg width='100' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q 25 0, 50 10 T 100 10' stroke='${encodeURIComponent(color)}' fill='none' stroke-width='2'/%3E%3C/svg%3E`;
    
    case 'diagonal':
      return `data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0' stroke='${encodeURIComponent(color)}' stroke-width='1'/%3E%3C/svg%3E`;
    
    case 'none':
    default:
      return '';
  }
};

type DashboardStats = {
  totalSets: number;
  setsDailyDelta: number;
  totalLikes: number;
  likesDailyDelta: number;
  artTotal: number | null;
  artDailyDelta?: number | null;
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
};

const pickFirstNumber = (values: unknown[], visited: WeakSet<object> = new WeakSet()): number | null => {
  for (const value of values) {
    const numeric = coerceNumber(value);
    if (numeric !== null) {
      return numeric;
    }
    if (value && typeof value === 'object') {
      if (visited.has(value as object)) {
        continue;
      }
      visited.add(value as object);
      const candidate = pickFirstNumber(
        [
          (value as any)?.total,
          (value as any)?.value,
          (value as any)?.amount,
          (value as any)?.sum
        ],
        visited
      );
      if (candidate !== null) {
        return candidate;
      }
    }
  }
  return null;
};

export default function StixlyTopHeader({
  profileMode,
  onSlideChange,
  fixedSlideId,
  bottomContent
}: StixlyTopHeaderProps = {}) {
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  const formattedTotalPacks = useMemo(() => {
    if (!dashboardStats) {
      return '—';
    }
    return RU_NUMBER_FORMATTER.format(dashboardStats.totalSets);
  }, [dashboardStats]);

  const formattedDailyChange = useMemo(() => {
    if (!dashboardStats) {
      return '—';
    }
    const prefix = dashboardStats.setsDailyDelta > 0 ? '+' : '';
    return `${prefix}${RU_NUMBER_FORMATTER.format(dashboardStats.setsDailyDelta)}`;
  }, [dashboardStats]);

  const formattedLikesDailyChange = useMemo(() => {
    if (!dashboardStats) {
      return '—';
    }
    const prefix = dashboardStats.likesDailyDelta > 0 ? '+' : '';
    return `${prefix}${RU_NUMBER_FORMATTER.format(dashboardStats.likesDailyDelta)}`;
  }, [dashboardStats]);

  const formattedTotalLikes = useMemo(() => {
    if (!dashboardStats) {
      return '—';
    }
    return RU_NUMBER_FORMATTER.format(dashboardStats.totalLikes);
  }, [dashboardStats]);

  const formattedArtTotal = useMemo(() => {
    if (!dashboardStats) {
      return '—';
    }
  const value = dashboardStats.artTotal;
  if (value === null || typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  if (Math.abs(value) < 1000 && value !== Math.trunc(value)) {
    return RU_NUMBER_FORMATTER_WITH_DECIMALS.format(value);
  }
  return RU_NUMBER_FORMATTER.format(Math.round(value));
  }, [dashboardStats]);

  const formattedArtDailyChange = useMemo(() => {
    if (!dashboardStats) {
      return '—';
    }
    const value = dashboardStats.artDailyDelta;
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    const prefix = value > 0 ? '+' : '';
    const absValue = Math.abs(value) < 1000 && value !== Math.trunc(value)
      ? RU_NUMBER_FORMATTER_WITH_DECIMALS.format(value)
      : RU_NUMBER_FORMATTER.format(Math.round(value));
    return `${prefix}${absValue}`;
  }, [dashboardStats]);

  const initialIndex = useMemo(() => {
    if (typeof fixedSlideId === 'number') {
      const rawIndex = RAW_SLIDES.findIndex((slide) => slide.id === fixedSlideId);
      return rawIndex >= 0 ? rawIndex : 0;
    }
    return 0;
  }, [fixedSlideId]);

  const [index, setIndex] = useState(initialIndex);

  const slides: Slide[] = useMemo(
    () => RAW_SLIDES.map((s) => ({ ...s, img: img(s.img) })),
    []
  );

  // Режим работы
  const isProfileMode = profileMode?.enabled === true;
  const activeProfileMode = isProfileMode ? (profileMode as ProfileModeConfig) : undefined;
  const isStaticSlide = !isProfileMode && typeof fixedSlideId === 'number';
  const isDashboardMode = !isProfileMode && fixedSlideId === 2;
  
  // Проверяем, нужна ли статистика (если есть слайд с id=2)
  const needsStats = !isProfileMode && slides.some(s => s.id === 2);

  useEffect(() => {
    let isActive = true;

    if (!needsStats) {
      setDashboardStats(null);
      return () => {
        isActive = false;
      };
    }

    const fetchDashboardStats = async () => {
      try {
        // Проверяем кэш в localStorage
        const CACHE_KEY = 'stixly_dashboard_stats';
        const CACHE_TTL = 10 * 60 * 1000; // 10 минут
        
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          try {
            const { data, timestamp } = JSON.parse(cachedData);
            const isExpired = Date.now() - timestamp > CACHE_TTL;
            
            if (!isExpired && data) {
              console.log('✅ Используем кэшированную статистику');
              setDashboardStats(data);
              return;
            }
          } catch (parseError) {
            console.warn('⚠️ Ошибка парсинга кэша статистики, запрашиваем с API');
          }
        }

        const statisticsResponse = await apiClient.getStatistics().catch((error) => {
          console.warn('⚠️ Не удалось получить общую статистику с /api/statistics', error);
          return null;
        });

        if (!isActive || !statisticsResponse) {
          return;
        }

        const totalSets =
          coerceNumber((statisticsResponse as any)?.stickerSets?.total) ?? 0;
        const setsDailyDelta =
          coerceNumber((statisticsResponse as any)?.stickerSets?.daily) ?? 0;
        const totalLikes =
          coerceNumber((statisticsResponse as any)?.likes?.total) ?? 0;
        const likesDailyDelta =
          coerceNumber((statisticsResponse as any)?.likes?.daily) ?? 0;

        const artTotal = pickFirstNumber([
          (statisticsResponse as any)?.art?.earned?.total,
          (statisticsResponse as any)?.art?.total,
          (statisticsResponse as any)?.art?.balance,
        ]);

        const artDelta = pickFirstNumber([
          (statisticsResponse as any)?.art?.earned?.daily,
          (statisticsResponse as any)?.art?.daily,
        ]);

        const statsData = {
          totalSets,
          setsDailyDelta,
          totalLikes,
          likesDailyDelta,
          artTotal,
          artDailyDelta: artDelta,
        };

        setDashboardStats(statsData);
        
        // Сохраняем в кэш
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: statsData,
            timestamp: Date.now()
          }));
          console.log('✅ Статистика сохранена в кэш');
        } catch (storageError) {
          console.warn('⚠️ Не удалось сохранить статистику в localStorage');
        }
      } catch (error) {
        console.warn('⚠️ Не удалось получить статистику для заголовка Dashboard', error);
        if (!isActive) {
          return;
        }
        setDashboardStats(null);
      }
    };

    fetchDashboardStats();

    return () => {
      isActive = false;
    };
  }, [needsStats]);

  useEffect(() => {
    if (isStaticSlide) {
      const staticIndex = slides.findIndex((slide) => slide.id === fixedSlideId);
      if (staticIndex >= 0 && staticIndex !== index) {
        setIndex(staticIndex);
      }
    }
  }, [isStaticSlide, fixedSlideId, slides, index]);

  // Уведомляем о смене слайда
  useEffect(() => {
    if (!isProfileMode && onSlideChange) {
      const current = slides[index];
      onSlideChange(current.bg);
    }
  }, [index, slides, isProfileMode, onSlideChange]);

  // Preload (только для обычного режима)
  useEffect(() => {
    if (isProfileMode) return;
    slides.forEach((s) => {
      const i = new Image();
      i.src = s.img;
    });
  }, [slides, isProfileMode]);

  // Autoplay (только для обычного режима)
  useEffect(() => {
    if (isProfileMode || isStaticSlide) return;
    const t = setInterval(() => setIndex((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length, isProfileMode, isStaticSlide]);

  const current = slides[index];

  const profilePatternUrl = activeProfileMode
    ? getPatternSVG(activeProfileMode.pattern)
    : undefined;

  const headerContent = isProfileMode && activeProfileMode ? (
    <div
      className="stixly-top-header--profile"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "600px", // ограничиваем фон до 600px
        margin: "0 auto", // центрируем
        height: "calc((var(--tg-viewport-stable-height, var(--tg-viewport-height, var(--stixly-viewport-height, 100vh))) * 0.146))", // 14.6% от высоты viewport (с поддержкой официальных переменных)
        maxHeight: "140px",
        zIndex: 1,
        overflow: "visible",
        borderBottomLeftRadius: "calc(100vw * 0.038)", // ~3.8% от ширины viewport
        borderBottomRightRadius: "calc(100vw * 0.038)",
        // Используем backgroundImage для объединения градиента и паттерна
        backgroundImage: profilePatternUrl 
          ? `${activeProfileMode.backgroundColor}, url(${profilePatternUrl})`
          : activeProfileMode.backgroundColor,
        backgroundRepeat: profilePatternUrl ? 'repeat, repeat' : 'no-repeat',
        backgroundSize: profilePatternUrl ? 'auto, auto' : 'cover',
        boxSizing: "border-box",
      }}
    >
      {/* Контент профиля */}
      {activeProfileMode.content && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "50px", // отступ для кнопок Telegram MiniApps
            paddingLeft: "16px",
            paddingRight: "16px",
            paddingBottom: "calc(100vw * 0.05)",
            maxWidth: "600px",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {activeProfileMode.content}
        </div>
      )}
    </div>
  ) : (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "600px", // ограничиваем фон до 600px
        margin: "0 auto", // центрируем
        height: "calc((var(--tg-viewport-stable-height, var(--tg-viewport-height, var(--stixly-viewport-height, 100vh))) * 0.146))", // 14.6% от высоты viewport (с поддержкой официальных переменных)
        maxHeight: "140px",
        zIndex: 1,
        overflow: bottomContent ? "visible" : "hidden",
        borderBottomLeftRadius: "calc(100vw * 0.038)", // ~3.8% от ширины viewport
        borderBottomRightRadius: "calc(100vw * 0.038)",
        pointerEvents: "auto", // разрешаем взаимодействия для кнопки
        boxSizing: "border-box",
      }}
    >
      {/* Статичный голубой градиент */}
      <div 
        style={{ 
          position: "absolute", 
          inset: 0, 
          background: "linear-gradient(180deg, #1D4ED8 0%, #38BDF8 100%)" 
        }}
      />

      <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, maxWidth: "600px", margin: "0 auto" }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={`content-${current.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            className="stixly-top-header__content"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: current.id === 2 ? "row" : "column",
              gap: current.id === 2 ? "clamp(12px, 5vw, 32px)" : undefined,
              color: "#fff",
              textAlign: "center",
              paddingLeft: current.id === 2 ? "12px" : "8px", // минимальные отступы по золотым пропорциям
              paddingRight: current.id === 2 ? "12px" : "8px",
              paddingTop: current.id === 2 ? "50px" : "50px", // отступ для кнопок Telegram MiniApps
            }}
          >
            {current.id === 2 ? (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  width: "100%",
                  maxWidth: "600px",
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "clamp(8px, 2vw, 12px)",
                  padding: "clamp(9px, 2.25vw, 15px) clamp(12px, 3vw, 18px)",
                  paddingTop: "50px",
                  color: "rgba(255,255,255,0.95)",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "clamp(20px, 5vw, 28px)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    color: "rgba(255,255,255,0.96)",
                    textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    textTransform: "uppercase",
                  }}
                >
                  СТАТИСТИКА
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "clamp(6px, 2.25vw, 12px)",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "clamp(6px, 1.5vw, 9px) clamp(9px, 2.25vw, 12px)",
                      borderRadius: "9px",
                      background: "rgba(255, 255, 255, 0.12)",
                      fontSize: "clamp(16.5px, 3.75vw, 21px)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      gap: "6px",
                    }}
                  >
                    <FavoriteIcon sx={{ fontSize: "clamp(16.5px, 3.75vw, 21px)", color: "var(--tg-theme-button-text-color, #ffffff) !important" }} />
                    <span>{formattedTotalLikes}</span>
                    <span style={{ opacity: 0.85, fontSize: "clamp(15px, 3vw, 18px)" }}>({formattedLikesDailyChange})</span>
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "clamp(6px, 1.5vw, 9px) clamp(9px, 2.25vw, 12px)",
                      borderRadius: "9px",
                      background: "rgba(255, 255, 255, 0.12)",
                      fontSize: "clamp(16.5px, 3.75vw, 21px)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      gap: "6px",
                    }}
                  >
                    <CollectionsIcon sx={{ fontSize: "clamp(16.5px, 3.75vw, 21px)", color: "var(--tg-theme-button-text-color, #ffffff) !important" }} />
                    <span>{formattedTotalPacks}</span>
                    <span style={{ opacity: 0.85, fontSize: "clamp(15px, 3vw, 18px)" }}>({formattedDailyChange})</span>
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "clamp(6px, 1.5vw, 9px) clamp(9px, 2.25vw, 12px)",
                      borderRadius: "9px",
                      background: "rgba(255, 255, 255, 0.12)",
                      fontSize: "clamp(16.5px, 3.75vw, 21px)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      gap: "6px",
                    }}
                  >
                    <span>🎨</span>
                    <span>{formattedArtTotal}</span>
                    <span style={{ opacity: 0.85, fontSize: "clamp(15px, 3vw, 18px)" }}>({formattedArtDailyChange})</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <img
                  src={current.img}
                  alt="Stixly"
                  style={{
                    width: "140px", // уменьшено для соответствия новой высоте
                    height: "auto",
                    marginBottom: "4px",
                    filter: "drop-shadow(0 0 10px rgba(255,255,255,0.28))",
                  }}
                  loading="eager"
                  decoding="async"
                />
                {current.text && (
                  <p
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                      bottom: 8,
                    margin: 0,
                    width: "100%",
                      fontSize: "clamp(14px, 3.8vw, 20px)",
                      lineHeight: 1.15,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.96)",
                    letterSpacing: "0.3px",
                      textShadow:
                        "0 1px 2px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.25)",
                  }}
                  >
                    {current.text}
                  </p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {bottomContent && (
        <div className="stixly-top-header__bottom-content" style={{ zIndex: 10 }}>
          {bottomContent}
        </div>
      )}
    </div>
  );

  const currentBgColor = activeProfileMode
    ? activeProfileMode.backgroundColor
    : current.bg;

  // Helper function to get viewport height (with fallback)
  const getViewportHeight = (): number => {
    // Check for official Telegram viewport CSS variables first
    const rootStyle = getComputedStyle(document.documentElement);
    const viewportHeight = rootStyle.getPropertyValue('--tg-viewport-height');
    const viewportStableHeight = rootStyle.getPropertyValue('--tg-viewport-stable-height');
    
    // Use stable height if available, otherwise regular height, otherwise fallback to window
    if (viewportStableHeight) {
      const value = parseFloat(viewportStableHeight);
      if (!isNaN(value) && value > 0) return value;
    }
    if (viewportHeight) {
      const value = parseFloat(viewportHeight);
      if (!isNaN(value) && value > 0) return value;
    }
    
    // Fallback to window.innerHeight or 100vh calculation
    return window.innerHeight || document.documentElement.clientHeight || 600;
  };

  // Update CSS variables for header height and viewport
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerElement = document.querySelector('.stixly-top-header');
      if (!headerElement) return;
      
      const rect = headerElement.getBoundingClientRect();
      const height = rect.height;
      // height уже включает paddingTop с env(safe-area-inset-top)
      document.documentElement.style.setProperty('--stixly-header-height', `${height}px`);
      
      // Диагностический лог (только в DEV режиме)
      if (import.meta.env.DEV) {
        console.log('[StixlyTopHeader] updateHeaderHeight:', {
          top: rect.top,
          height: rect.height,
          pathname: window.location.pathname,
          isExpanded: window.Telegram?.WebApp?.isExpanded
        });
      }
      
      // Update viewport height CSS variable (with fallback support)
      const viewportHeight = getViewportHeight();
      const rootStyle = getComputedStyle(document.documentElement);
      const tgViewportHeight = rootStyle.getPropertyValue('--tg-viewport-stable-height') || 
                               rootStyle.getPropertyValue('--tg-viewport-height');
      
      // Use official Telegram viewport variable if available, otherwise use calculated value
      if (!tgViewportHeight || tgViewportHeight.trim() === '') {
        document.documentElement.style.setProperty('--stixly-viewport-height', `${viewportHeight}px`);
      }
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    
    // Подписка на кастомное событие изменения safe area insets
    const safeAreaInsetsChangedHandler = () => {
      // Небольшая задержка для гарантии применения CSS
      requestAnimationFrame(() => {
        updateHeaderHeight();
      });
    };
    window.addEventListener('safeAreaInsetsChanged', safeAreaInsetsChangedHandler);

    // Подписка на событие viewportChanged от Telegram WebApp для iOS safe area
    const webApp = window.Telegram?.WebApp;
    const viewportChangedHandler = () => {
      updateHeaderHeight();
    };

    if (webApp && typeof webApp.onEvent === 'function') {
      webApp.onEvent('viewportChanged', viewportChangedHandler);
    }

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      window.removeEventListener('safeAreaInsetsChanged', safeAreaInsetsChangedHandler);
      if (webApp && typeof webApp.offEvent === 'function') {
        webApp.offEvent('viewportChanged', viewportChangedHandler);
      }
    };
  }, []);

  return (
    <header id="stixlytopheader" className="stixly-top-header">
      <div className="stixly-top-header-inner">
        {/* iOS time panel area - занимает всю верхнюю область включая safe area */}
        <div 
          data-cursor-element-id="cursor-el-1"
          className="stixly-ios-time-panel-area"
        />
        {headerContent}
      </div>
    </header>
  );
}


