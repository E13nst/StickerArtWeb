import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "../api/client";
import CollectionsIcon from "@mui/icons-material/Collections";

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
  showThemeToggle?: boolean;
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
    bg: "linear-gradient(180deg, #000000 0%, #111111 100%)",
    img: "stixly-logo-light.webp",
    text: "Find, create & smile with stickers",
  },
  {
    id: 2,
    bg: "linear-gradient(180deg, #1D4ED8 0%, #38BDF8 100%)",
    img: "stixly-logo-orange.webp",
    text: "",
  },
  {
    id: 3,
    bg: "linear-gradient(180deg, #3B1D73 0%, #2CD9FF 100%)",
    img: "stixly-mascot.webp",
    text: "Your Universe of stickers",
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

// Специальная кнопка переключения тем для StixlyTopHeader
const StixlyThemeToggle: React.FC<{ currentBg: string }> = ({ currentBg }) => {
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('stixly_tg_theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.scheme === 'dark';
      }
    } catch {}
    return document.documentElement.classList.contains('tg-dark-theme');
  });

  const handleToggle = () => {
    const next = !isDark;
    setIsDark(next);
    
    // Применяем тему
    const scheme = next ? 'dark' : 'light';
    const lightTheme = {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#2481cc',
      button_color: '#2481cc',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f8f9fa',
      border_color: '#e0e0e0',
      shadow_color: 'rgba(0, 0, 0, 0.1)',
      overlay_color: 'rgba(0, 0, 0, 0.7)',
    };
    
    const darkTheme = {
      bg_color: '#18222d',
      text_color: '#ffffff',
      hint_color: '#708499',
      link_color: '#6ab2f2',
      button_color: '#5288c1',
      button_text_color: '#ffffff',
      secondary_bg_color: '#131415',
      border_color: '#2a3441',
      shadow_color: 'rgba(0, 0, 0, 0.3)',
      overlay_color: 'rgba(0, 0, 0, 0.8)',
    };
    
    const params = next ? darkTheme : lightTheme;
    const root = document.documentElement;
    const body = document.body;
    
    root.style.setProperty('--tg-theme-bg-color', params.bg_color);
    root.style.setProperty('--tg-theme-text-color', params.text_color);
    root.style.setProperty('--tg-theme-hint-color', params.hint_color);
    root.style.setProperty('--tg-theme-button-color', params.button_color);
    root.style.setProperty('--tg-theme-button-text-color', params.button_text_color);
    root.style.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color);
    root.style.setProperty('--tg-theme-link-color', params.link_color);
    root.style.setProperty('--tg-theme-border-color', params.border_color);
    root.style.setProperty('--tg-theme-shadow-color', params.shadow_color);
    root.style.setProperty('--tg-theme-overlay-color', params.overlay_color);
    
    body.style.backgroundColor = params.bg_color;
    body.style.color = params.text_color;
    
    if (scheme === 'dark') {
      root.classList.add('tg-dark-theme');
      root.classList.remove('tg-light-theme');
    } else {
      root.classList.add('tg-light-theme');
      root.classList.remove('tg-dark-theme');
    }
    
    // Сохраняем тему
    try {
      localStorage.setItem('stixly_tg_theme', JSON.stringify({ scheme, params }));
    } catch {}
  };
  const topColor = isDark ? '#ffffff' : '#111111';
  const bottomColor = isDark ? 'var(--tg-theme-bg-color, #111111)' : '#ffffff';
  const hoverTopColor = isDark ? '#ffffff' : '#1a1a1a';
  const hoverBottomColor = isDark ? 'var(--tg-theme-bg-color, #111111)' : '#f4f4f4';

  const baseGradient = `linear-gradient(135deg, ${topColor} 0%, ${topColor} 50%, ${bottomColor} 50%, ${bottomColor} 100%)`;
  const hoverGradient = `linear-gradient(135deg, ${hoverTopColor} 0%, ${hoverTopColor} 50%, ${hoverBottomColor} 50%, ${hoverBottomColor} 100%)`;

  return (
    <button
      onClick={handleToggle}
      style={{
        position: 'absolute',
        bottom: '-1px',
        right: '0px',
        width: 'calc(100vw * 0.084)', // ~8.4% от ширины viewport
        height: 'calc(100vw * 0.084)',
        minWidth: '28px',
        minHeight: '28px',
        maxWidth: '40px',
        maxHeight: '40px',
        borderRadius: 0,
        borderTopLeftRadius: '10px',
        borderBottomRightRadius: '10px',
        border: 'none',
        background: baseGradient,
        color: '#111111',
        fontSize: 'calc(100vw * 0.042)', // ~4.2% от ширины viewport
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        backdropFilter: 'blur(4px)',
        boxShadow: 'none',
        zIndex: 10,
        padding: 0,
        margin: 0,
        outline: 'none',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverGradient;
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseGradient;
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
    >
      <span style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        width: '100%',
        height: '100%',
        paddingTop: '5px',
        paddingLeft: '2px',
        lineHeight: 1,
        transform: 'translateY(-1px)',
        fontSize: '0.8em'
      }}>
        {isDark ? '☀️' : '🌙'}
      </span>
    </button>
  );
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
  showThemeToggle = true
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

  useEffect(() => {
    let isActive = true;

    if (!isDashboardMode) {
      setDashboardStats(null);
      return () => {
        isActive = false;
      };
    }

    const fetchDashboardStats = async () => {
      try {
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

        setDashboardStats({
          totalSets,
          setsDailyDelta,
          totalLikes,
          likesDailyDelta,
          artTotal,
          artDailyDelta: artDelta,
        });
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
  }, [isDashboardMode]);

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
  const isMascot = current.img.includes("mascot");

  const profilePatternUrl = activeProfileMode
    ? getPatternSVG(activeProfileMode.pattern)
    : undefined;

  const headerContent = isProfileMode && activeProfileMode ? (
    <div
      className="stixly-top-header stixly-top-header--profile"
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh * 0.146)", // 14.6% от высоты viewport (упрощенная золотая пропорция)
        minHeight: "100px",
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
      }}
    >
      {/* Контент профиля */}
      {activeProfileMode.content && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "calc(100vw * 0.05)", // ~5% от ширины viewport
          }}
        >
          {activeProfileMode.content}
        </div>
      )}
    </div>
  ) : (
    <div
      className="stixly-top-header"
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh * 0.146)", // 14.6% от высоты viewport (упрощенная золотая пропорция)
        minHeight: "100px",
        maxHeight: "140px",
        zIndex: 1,
        overflow: "hidden",
        borderBottomLeftRadius: "calc(100vw * 0.038)", // ~3.8% от ширины viewport
        borderBottomRightRadius: "calc(100vw * 0.038)",
        pointerEvents: "auto", // разрешаем взаимодействия для кнопки
      }}
    >
      {/* Два слоя для идеального кросс‑фейда без пустоты */}
      <div style={{ position: "absolute", inset: 0 }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={`bg-${current.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            style={{ position: "absolute", inset: 0, background: current.bg }}
          />
        </AnimatePresence>
      </div>

      <div style={{ position: "absolute", inset: 0 }}>
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
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: isDashboardMode
                ? "center"
                : isMascot
                  ? "space-between"
                  : "center",
              flexDirection: isDashboardMode || isMascot ? "row" : "column",
              gap: isDashboardMode ? "clamp(12px, 5vw, 32px)" : undefined,
              color: "#fff",
              textAlign: "center",
              paddingLeft: isDashboardMode ? "12px" : "8px", // минимальные отступы по золотым пропорциям
              paddingRight: isDashboardMode ? "12px" : "8px",
              paddingTop: isDashboardMode ? "10px" : "12px", // оптимизировано для меньшей высоты
            }}
          >
            {isDashboardMode ? (
              <div
                style={{
                  width: "100%",
                  maxWidth: "clamp(320px, 82%, 640px)",
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  color: "rgba(255,255,255,0.92)",
                  textAlign: "center",
                  paddingLeft: "clamp(6px, 2vw, 14px)",
                  paddingRight: "clamp(6px, 2vw, 14px)",
                }}
              >
                <span
                  style={{
                    fontSize: "clamp(20px, 5vw, 28px)",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    color: "rgba(255,255,255,0.96)",
                    textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    marginBottom: "clamp(12px, 3vw, 20px)",
                    marginTop: "clamp(-8px, -2vw, -4px)",
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
                    gap: "clamp(6px, 2vw, 12px)",
                    flexWrap: "nowrap",
                    width: "100%",
                    paddingLeft: "clamp(4px, 1vw, 8px)",
                    paddingRight: "clamp(4px, 1vw, 8px)",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.15)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                      fontSize: "clamp(11px, 2.8vw, 16px)",
                      fontWeight: 600,
                      textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      whiteSpace: "nowrap",
                      flex: "1 1 0",
                      minWidth: 0,
                      justifyContent: "center",
                      overflow: "visible",
                    }}
                  >
                    <span 
                      style={{ 
                        position: "absolute",
                        left: "50%",
                        top: "0",
                        transform: "translate(-50%, -61.8%)",
                        fontSize: "clamp(32px, 8vw, 56px)",
                        opacity: 0.15,
                        zIndex: 0,
                        pointerEvents: "none",
                      }}
                    >
                      ❤️
                    </span>
                    <span style={{ position: "relative", zIndex: 1, fontSize: "clamp(14px, 3.5vw, 20px)", fontWeight: 700 }}>{formattedTotalLikes}</span>
                    <span style={{ position: "relative", zIndex: 1, fontSize: "clamp(10px, 2.5vw, 14px)", opacity: 0.9, marginLeft: "3px", fontWeight: 500 }}>({formattedLikesDailyChange})</span>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "clamp(7px, 1.8vw, 11px) clamp(9px, 2.2vw, 13px)",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.15)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                      fontSize: "clamp(12px, 3.2vw, 18px)",
                      fontWeight: 600,
                      textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      whiteSpace: "nowrap",
                      flex: "1 1 0",
                      minWidth: 0,
                      justifyContent: "center",
                      overflow: "visible",
                    }}
                  >
                    <CollectionsIcon 
                      sx={{ 
                        position: "absolute",
                        left: "50%",
                        top: "0",
                        transform: "translate(-50%, -61.8%)",
                        fontSize: "clamp(32px, 8vw, 56px)",
                        opacity: 0.15,
                        zIndex: 0,
                        pointerEvents: "none",
                        color: "rgba(255, 255, 255, 0.95)",
                      }} 
                    />
                    <span style={{ position: "relative", zIndex: 1, fontSize: "clamp(15px, 4vw, 22px)", fontWeight: 700 }}>{formattedTotalPacks}</span>
                    <span style={{ position: "relative", zIndex: 1, fontSize: "clamp(11px, 2.8vw, 16px)", opacity: 0.9, marginLeft: "3px", fontWeight: 500 }}>({formattedDailyChange})</span>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)",
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.15)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                      fontSize: "clamp(11px, 2.8vw, 16px)",
                      fontWeight: 600,
                      textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      whiteSpace: "nowrap",
                      flex: "1 1 0",
                      minWidth: 0,
                      justifyContent: "center",
                      overflow: "visible",
                    }}
                  >
                    <span 
                      style={{ 
                        position: "absolute",
                        left: "50%",
                        top: "0",
                        transform: "translate(-50%, -61.8%)",
                        fontSize: "clamp(32px, 8vw, 56px)",
                        opacity: 0.15,
                        zIndex: 0,
                        pointerEvents: "none",
                      }}
                    >
                      🪙
                    </span>
                    <span style={{ position: "relative", zIndex: 1, fontSize: "clamp(14px, 3.5vw, 20px)", fontWeight: 700 }}>{formattedArtTotal}</span>
                    <span style={{ position: "relative", zIndex: 1, fontSize: "clamp(10px, 2.5vw, 14px)", opacity: 0.9, marginLeft: "3px", fontWeight: 500 }}>({formattedArtDailyChange})</span>
                  </div>
                </div>
              </div>
            ) : isMascot ? (
              <>
                <div
                  style={{
                    flex: "1 1 0%",
                    textAlign: "left",
                    paddingRight: "12px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "clamp(16px, 4.6vw, 24px)",
                      lineHeight: 1.15,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.96)",
                      letterSpacing: "0.2px",
                      textShadow:
                        "0 1px 2px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.25)",
                      transform: "translateY(10px)",
                    }}
                  >
                    {current.text}
                  </p>
                </div>
                <img
                  src={current.img}
                  alt="Stixly"
                  style={{
                    flex: "0 0 auto",
                    width: "180px", // уменьшено для соответствия новой высоте
                    height: "auto",
                    filter: "drop-shadow(0 0 10px rgba(255,255,255,0.28))",
                  }}
                  loading="eager"
                  decoding="async"
                />
              </>
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
    </div>
  );

  const currentBgColor = activeProfileMode
    ? activeProfileMode.backgroundColor
    : current.bg;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {headerContent}
      {showThemeToggle && <StixlyThemeToggle currentBg={currentBgColor} />}
    </div>
  );
}


