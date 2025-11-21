import React from 'react';
import { useTelegram } from '../hooks/useTelegram';

interface StickerTypeFilterProps {
  selectedTypes: string[];
  onTypeToggle: (typeId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

const STICKER_TYPES = [
  { id: 'static', label: 'Статичные', emoji: '🖼️' },
  { id: 'animated', label: 'Анимированные', emoji: '✨' },
  { id: 'video', label: 'Видео', emoji: '🎬' },
  { id: 'official', label: 'Официальные', emoji: '✓' },
];

export const StickerTypeFilter: React.FC<StickerTypeFilterProps> = ({
  selectedTypes,
  onTypeToggle,
  disabled = false,
  compact = false,
}) => {
  const { tg } = useTelegram();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;
  
  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.32)' : 'rgba(88, 138, 255, 0.24)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.48)' : 'rgba(78, 132, 255, 0.24)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.42)' : 'rgba(98, 150, 255, 0.38)';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';
  
  const padding = compact ? '0.35rem 0.7rem' : '0.45rem 0.9rem';
  const fontSize = compact ? '0.75rem' : '0.8125rem';
  const baseOpacityUnselected = compact ? 0.72 : 0.88;

  const handleTypeClick = (typeId: string) => {
    if (disabled) return;
    
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    onTypeToggle(typeId);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: compact ? '0.4rem' : '0.5rem',
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: compact ? '0.3rem 0' : '0.5rem 0',
        scrollbarWidth: 'none',
        maskImage: 'none',
        WebkitMaskImage: 'none',
      }}
      className="sticker-type-filter-scroller"
    >
      {STICKER_TYPES.map((type) => {
        const isSelected = selectedTypes.includes(type.id);
        const baseBackground = isSelected
          ? 'color-mix(in srgb, rgba(148, 122, 255, 0.52) 72%, transparent)'
          : glassBase;
        const baseSolid = isSelected
          ? 'color-mix(in srgb, rgba(148, 122, 255, 0.52) 72%, transparent)'
          : glassSolid;
        const baseTransform = isSelected ? 'scale(0.98)' : 'scale(1)';
        const baseOpacity = isSelected ? 1 : baseOpacityUnselected;

        return (
          <div
            key={type.id}
            role="tab"
            aria-selected={isSelected}
            tabIndex={0}
            title={type.label}
            onClick={() => handleTypeClick(type.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTypeClick(type.id);
              }
            }}
            style={{
              flexShrink: 0,
              padding: padding,
              borderRadius: '0.75rem',
              background: baseBackground,
              backgroundColor: baseSolid,
              color: textColorResolved,
              fontSize: fontSize,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: `1px solid ${borderColor}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              userSelect: 'none',
              opacity: disabled ? 0.5 : baseOpacity,
              transform: baseTransform,
              backdropFilter: 'blur(16px) saturate(140%)',
              WebkitBackdropFilter: 'blur(16px) saturate(140%)',
              gap: '0.35rem',
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                Object.assign(e.currentTarget.style, {
                  background: glassHover,
                  backgroundColor: glassHover,
                  transform: 'scale(0.98)',
                  opacity: '1',
                  backdropFilter: 'blur(18px) saturate(220%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(220%)',
                });
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled) {
                Object.assign(e.currentTarget.style, {
                  background: baseBackground,
                  backgroundColor: baseSolid,
                  transform: baseTransform,
                  opacity: String(baseOpacity),
                  backdropFilter: 'blur(16px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(140%)',
                });
              }
            }}
          >
            <span style={{ fontSize: '1em' }}>{type.emoji}</span>
            <span>{type.label}</span>
          </div>
        );
      })}
      <style>{`
        .sticker-type-filter-scroller::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

