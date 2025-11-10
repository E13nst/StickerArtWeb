import React from 'react';
import { useTelegram } from '../hooks/useTelegram';

export interface Category {
  id: string;
  label: string;
  title?: string; // Tooltip
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategories: string[];
  onCategoryToggle: (categoryId: string) => void;
  disabled?: boolean;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategories,
  onCategoryToggle,
  disabled = false
}) => {
  const { tg } = useTelegram();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;
  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.32)' : 'rgba(88, 138, 255, 0.24)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.48)' : 'rgba(78, 132, 255, 0.24)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.42)' : 'rgba(98, 150, 255, 0.38)';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';
  const accentShadow = isLight ? '0 6px 18px rgba(30, 72, 185, 0.14)' : '0 6px 18px rgba(28, 48, 108, 0.28)';
  const accentShadowHover = isLight ? '0 10px 26px rgba(30, 72, 185, 0.18)' : '0 10px 26px rgba(28, 48, 108, 0.34)';

  const handleCategoryClick = (categoryId: string) => {
    if (disabled) return;
    
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    onCategoryToggle(categoryId);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '0.5rem 0',
        scrollbarWidth: 'none',
        maskImage: 'none',
        WebkitMaskImage: 'none',
      }}
      className="category-filter-scroller"
    >
      {categories.map((category) => {
        const isSelected = selectedCategories.includes(category.id);
        const baseBorder = borderColor;
        const baseBackground = isSelected
          ? 'color-mix(in srgb, rgba(148, 122, 255, 0.52) 72%, transparent)'
          : glassBase;
        const baseSolid = isSelected
          ? 'color-mix(in srgb, rgba(148, 122, 255, 0.52) 72%, transparent)'
          : glassSolid;
        const baseShadow = accentShadow;
        const baseTransform = isSelected ? 'scale(0.98)' : 'scale(1)';
        const baseOpacity = isSelected ? 1 : 0.88;
        const baseSaturate = isSelected ? 'saturate(220%)' : 'saturate(140%)';

        const hoverBackground = isSelected
          ? 'color-mix(in srgb, rgba(148, 122, 255, 0.62) 78%, transparent)'
          : glassHover;
        const hoverSolid = hoverBackground;
        const hoverShadow = accentShadow;

        const applyHoverStyles = (element: HTMLDivElement) => {
          Object.assign(element.style, {
            background: glassHover,
            backgroundColor: glassHover,
            transform: 'scale(0.98)',
            boxShadow: accentShadowHover,
          });
        };

        const applyBaseStyles = (element: HTMLDivElement) => {
          Object.assign(element.style, {
            background: baseBackground,
            backgroundColor: baseSolid,
            transform: baseTransform,
            boxShadow: baseShadow,
          });
        };
        
        return (
          <div
            key={category.id}
            role="tab"
            aria-selected={isSelected}
            tabIndex={0}
            title={category.title || category.label}
            onClick={() => handleCategoryClick(category.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCategoryClick(category.id);
              }
              if (e.key === 'Escape') {
                (e.target as HTMLDivElement).blur();
              }
            }}
            style={{
              flexShrink: 0,
              padding: '0.45rem 0.9rem',
              borderRadius: '0.75rem',
              background: baseBackground,
              backgroundColor: baseSolid,
              color: textColorResolved,
              fontSize: '0.8125rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: `1px solid ${baseBorder}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              userSelect: 'none',
              opacity: disabled ? 0.5 : baseOpacity,
              boxShadow: baseShadow,
              transform: baseTransform,
              backdropFilter: `blur(16px) ${baseSaturate}`,
              WebkitBackdropFilter: `blur(16px) ${baseSaturate}`,
            }}
            onMouseEnter={(event) => {
              if (disabled) return;
              Object.assign(event.currentTarget.style, {
                background: hoverBackground,
                backgroundColor: hoverSolid,
                borderColor: borderColor,
                boxShadow: hoverShadow,
                transform: 'scale(0.98)',
                opacity: '1',
                backdropFilter: 'blur(18px) saturate(220%)',
                WebkitBackdropFilter: 'blur(18px) saturate(220%)',
                color: textColorResolved,
              });
            }}
            onMouseLeave={(event) => {
              if (disabled) return;
              Object.assign(event.currentTarget.style, {
                background: baseBackground,
                backgroundColor: baseSolid,
                borderColor: baseBorder,
                boxShadow: baseShadow,
                transform: baseTransform,
                opacity: disabled ? '0.5' : String(baseOpacity),
                backdropFilter: `blur(16px) ${baseSaturate}`,
                WebkitBackdropFilter: `blur(16px) ${baseSaturate}`,
                color: textColorResolved,
              });
            }}
            onFocus={(event) => {
              if (disabled) return;
              Object.assign(event.currentTarget.style, {
                background: hoverBackground,
                backgroundColor: hoverSolid,
                borderColor: borderColor,
                boxShadow: hoverShadow,
                transform: 'scale(0.98)',
                opacity: '1',
                backdropFilter: 'blur(18px) saturate(220%)',
                WebkitBackdropFilter: 'blur(18px) saturate(220%)',
                color: textColorResolved,
              });
            }}
            onBlur={(event) => {
              if (disabled) return;
              Object.assign(event.currentTarget.style, {
                background: baseBackground,
                backgroundColor: baseSolid,
                borderColor: baseBorder,
                boxShadow: baseShadow,
                transform: baseTransform,
                opacity: disabled ? '0.5' : String(baseOpacity),
                backdropFilter: `blur(16px) ${baseSaturate}`,
                WebkitBackdropFilter: `blur(16px) ${baseSaturate}`,
                color: textColorResolved,
              });
            }}
          >
            {category.label}
          </div>
        );
      })}
      <style>{`
        .category-filter-scroller::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};








