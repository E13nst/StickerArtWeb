import React, { useState, useRef, useEffect } from 'react';
;
import { KeyboardArrowDownIcon, CheckIcon } from '@/components/ui/Icons';
import { useTelegram } from '../hooks/useTelegram';
import { StylePreset } from '../api/client';

interface StylePresetDropdownProps {
  presets: StylePreset[];
  selectedPresetId: number | null;
  onPresetChange: (presetId: number | null) => void;
  disabled?: boolean;
}

export const StylePresetDropdown: React.FC<StylePresetDropdownProps> = ({
  presets,
  selectedPresetId,
  onPresetChange,
  disabled = false,
}) => {
  const { tg } = useTelegram();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.32)' : 'rgba(88, 138, 255, 0.24)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.48)' : 'rgba(78, 132, 255, 0.24)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.42)' : 'rgba(98, 150, 255, 0.38)';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';
  const bgColor = isLight ? 'rgba(248, 251, 255, 0.95)' : 'rgba(18, 22, 29, 0.95)';
  const hintColor = isLight ? 'rgba(13, 27, 42, 0.6)' : 'var(--tg-theme-hint-color, rgba(255, 255, 255, 0.6))';

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    setIsOpen(!isOpen);
  };

  const handlePresetSelect = (presetId: number | null) => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    onPresetChange(presetId);
    setIsOpen(false);
  };

  const getSelectedLabel = () => {
    if (selectedPresetId === null) {
      return 'Без стиля';
    }
    const selected = presets.find(p => p.id === selectedPresetId);
    return selected?.name || 'Без стиля';
  };

  const allOptions = [
    { id: null, name: 'Без стиля', description: 'Без применения пресета стиля' },
    ...presets.map(p => ({ id: p.id, name: p.name, description: p.description }))
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Dropdown trigger button */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          borderRadius: '16px',
          background: glassBase,
          backgroundColor: glassSolid,
          color: textColorResolved,
          fontSize: '15px',
          fontWeight: 500,
          border: `1px solid ${borderColor}`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          outline: 'none',
          userSelect: 'none',
          opacity: disabled ? 0.5 : 1,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            Object.assign(e.currentTarget.style, {
              background: glassHover,
              backgroundColor: glassHover,
              transform: 'scale(0.99)',
            });
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            Object.assign(e.currentTarget.style, {
              background: glassBase,
              backgroundColor: glassSolid,
              transform: 'scale(1)',
            });
          }
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{getSelectedLabel()}</span>
        <KeyboardArrowDownIcon 
          sx={{ 
            fontSize: '1.2rem',
            transition: 'transform 0.3s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          sx={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            left: 0,
            right: 0,
            zIndex: 'var(--z-dropdown, 300)',
            backgroundColor: bgColor,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '16px',
            border: `1px solid ${borderColor}`,
            boxShadow: isLight 
              ? '0 8px 24px rgba(30, 72, 185, 0.15)' 
              : '0 8px 24px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            animation: 'fadeSlideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {allOptions.map((option) => {
            const isSelected = selectedPresetId === option.id;
            return (
              <div
                key={option.id === null ? 'none' : option.id}
                onClick={() => handlePresetSelect(option.id)}
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  backgroundColor: isSelected ? glassBase : 'transparent',
                  borderBottom: '1px solid color-mix(in srgb, var(--tg-theme-border-color) 10%, transparent)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = glassBase;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected ? glassBase : 'transparent';
                }}
              >
                {/* Name and checkmark */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}>
                  <span style={{ 
                    fontSize: '15px', 
                    color: textColorResolved,
                    fontWeight: isSelected ? 600 : 500,
                    flex: 1,
                    textAlign: 'left',
                  }}>
                    {option.name}
                  </span>
                  {isSelected && (
                    <CheckIcon 
                      sx={{ 
                        fontSize: '1.2rem', 
                        color: 'var(--tg-theme-button-color, #3390ec)',
                      }} 
                    />
                  )}
                </div>
                {/* Description */}
                {option.description && (
                  <span style={{
                    fontSize: '13px',
                    color: hintColor,
                    textAlign: 'left',
                  }}>
                    {option.description}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
