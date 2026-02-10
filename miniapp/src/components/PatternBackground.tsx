import { useEffect, useState, useRef, useCallback, FC, CSSProperties } from 'react';
import './PatternBackground.css';

const PARALLAX_FACTOR = 0.15;
const SCROLL_SELECTOR = '.stixly-main-scroll';

/**
 * Фон страницы: повторяющийся SVG-паттерн с лёгким параллаксом от скролла.
 * Паттерны лежат в public/assets/patterns/ (heart-fill.svg, heart-stroke.svg).
 * patternSrc — путь к SVG или URL; для выбора эмодзи с API подставить URL.
 */
interface PatternBackgroundProps {
  /** Путь к SVG (например /assets/patterns/heart-fill.svg) или URL */
  patternSrc: string;
  /** Размер тайла паттерна (например "80px", "120px") */
  size?: string;
  /** Прозрачность слоя паттерна 0–1 */
  opacity?: number;
  /** Показывать ли градиентный оверлей сверху */
  overlay?: boolean;
  /** CSS-фильтр для подкраски паттерна */
  patternFilter?: string;
  /** Тестовый второй слой паттерна с другим масштабом */
  dualScaleTest?: boolean;
  /** Размер тайла второго слоя */
  secondarySize?: string;
  /** Прозрачность второго слоя */
  secondaryOpacity?: number;
}

export const PatternBackground: FC<PatternBackgroundProps> = ({
  patternSrc,
  size = 'var(--page-pattern-size-md, clamp(144px, 21vw, 233px))',
  opacity = 0.12,
  overlay = true,
  patternFilter = 'brightness(0) saturate(100%) invert(45%) sepia(88%) saturate(1770%) hue-rotate(296deg) brightness(98%) contrast(95%)',
  dualScaleTest = false,
  secondarySize = 'var(--page-pattern-size-lg, clamp(233px, 34vw, 377px))',
  secondaryOpacity = 0.07,
}) => {
  const [offsetY, setOffsetY] = useState(0);
  const rafId = useRef<number | null>(null);
  const ticking = useRef(false);

  const updateOffset = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const el = document.querySelector<HTMLElement>(SCROLL_SELECTOR);
    if (!el) return;
    const scrollTop = el.scrollTop ?? 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOffsetY(0);
      return;
    }
    setOffsetY(scrollTop * PARALLAX_FACTOR);
    ticking.current = false;
  }, []);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(SCROLL_SELECTOR);
    if (!el) return;

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      rafId.current = requestAnimationFrame(() => {
        updateOffset();
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    updateOffset();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, [updateOffset]);

  return (
    <div
      className="pattern-background"
      aria-hidden
      style={
        {
          '--pattern-offset-y': offsetY,
          '--pattern-offset-y-secondary': offsetY * 0.55,
        } as CSSProperties
      }
    >
      <div
        className="pattern-background__layer"
        style={{
          backgroundImage: `url(${patternSrc})`,
          backgroundSize: size,
          opacity,
          filter: patternFilter,
        }}
      />
      {dualScaleTest && (
        <div
          className="pattern-background__layer pattern-background__layer--secondary"
          style={{
            backgroundImage: `url(${patternSrc})`,
            backgroundSize: secondarySize,
            opacity: secondaryOpacity,
            filter: patternFilter,
          }}
        />
      )}
      {overlay && <div className="pattern-background__overlay" />}
    </div>
  );
};
