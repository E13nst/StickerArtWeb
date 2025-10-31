import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
}

type Slide = {
  id: number;
  bg: string;
  img: string;
  text: string;
};

const RAW_SLIDES: Omit<Slide, "img"> & { img: string }[] = [
  {
    id: 1,
    bg: "linear-gradient(180deg, #000000 0%, #111111 100%)",
    img: "stixly-logo-light.webp",
    text: "Find, create & smile with stickers",
  },
  {
    id: 2,
    bg: "linear-gradient(180deg, #FF6700 0%, #FF944D 100%)",
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

  // Определяем цвет границы в зависимости от фона
  const getBorderColor = () => {
    if (currentBg.includes('#000000') || currentBg.includes('#111111')) {
      // Чёрный фон - белая граница
      return 'rgba(255, 255, 255, 0.8)';
    } else if (currentBg.includes('#FF6700') || currentBg.includes('#FF944D')) {
      // Оранжевый фон - белая граница
      return 'rgba(255, 255, 255, 0.8)';
    } else if (currentBg.includes('#3B1D73') || currentBg.includes('#2CD9FF')) {
      // Фиолетово-голубой фон - белая граница
      return 'rgba(255, 255, 255, 0.8)';
    }
    return 'rgba(255, 255, 255, 0.8)';
  };

  const borderColor = getBorderColor();

  return (
    <button
      onClick={handleToggle}
      style={{
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: `1px solid ${borderColor}`,
        background: 'transparent',
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        zIndex: 10,
        padding: 0,
        margin: 0,
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 1)';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.borderWidth = '1px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.borderWidth = '1px';
      }}
      aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
    >
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        lineHeight: 1,
        transform: 'translateY(-1px)' // Небольшая корректировка для идеального центрирования
      }}>
        {isDark ? '☀️' : '🌙'}
      </span>
    </button>
  );
};

export default function StixlyTopHeader({ profileMode }: StixlyTopHeaderProps = {}) {
  const [index, setIndex] = useState(0);

  const slides: Slide[] = useMemo(
    () => RAW_SLIDES.map((s) => ({ ...s, img: img(s.img) })),
    []
  );

  // Режим работы
  const isProfileMode = profileMode?.enabled === true;

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
    if (isProfileMode) return;
    const t = setInterval(() => setIndex((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length, isProfileMode]);

  const current = slides[index];
  const isMascot = current.img.includes("mascot");

  // ============ Профильный режим ============
  if (isProfileMode) {
    const patternUrl = getPatternSVG(profileMode.pattern);
    
    return (
      <div
        className="stixly-top-header stixly-top-header--profile"
        style={{
          position: "relative",
          width: "100%",
          height: "280px",
          zIndex: 1,
          overflow: "visible",
          borderBottomLeftRadius: "1.5rem",
          borderBottomRightRadius: "1.5rem",
          background: profileMode.backgroundColor,
          backgroundImage: patternUrl ? `url(${patternUrl})` : undefined,
          backgroundRepeat: 'repeat',
        }}
      >
        {/* Контент профиля */}
        {profileMode.content && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            {profileMode.content}
          </div>
        )}
      </div>
    );
  }

  // ============ Обычный режим (карусель) ============

  return (
    <div
      className="stixly-top-header"
      style={{
        position: "relative",
        width: "100%",
        height: "119px", // 14.6% золотой пропорции для минимальных элементов
        zIndex: 1,
        overflow: "hidden",
        borderBottomLeftRadius: "1.5rem",
        borderBottomRightRadius: "1.5rem",
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
              justifyContent: isMascot ? "space-between" : "center",
              flexDirection: isMascot ? "row" : "column",
              color: "#fff",
              textAlign: "center",
              paddingLeft: "8px", // минимальные отступы по золотым пропорциям
              paddingRight: "8px",
              paddingTop: "12px", // оптимизировано для меньшей высоты
            }}
          >
            {isMascot ? (
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

      {/* Кнопка переключения тем */}
      <StixlyThemeToggle currentBg={current.bg} />
    </div>
  );
}


