import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTelegram } from '../hooks/useTelegram';

interface StickerTypeDropdownProps {
  selectedTypes: string[];
  onTypeToggle: (typeId: string) => void;
  disabled?: boolean;
}

const STICKER_TYPES = [
  { id: 'static', label: 'Статичные', emoji: '🖼️' },
  { id: 'animated', label: 'Анимированные', emoji: '✨' },
  { id: 'video', label: 'Видео', emoji: '🎬' },
  { id: 'official', label: 'Официальные', emoji: '✓' },
];

export const StickerTypeDropdown: React.FC<StickerTypeDropdownProps> = ({
  selectedTypes,
  onTypeToggle,
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

  const handleTypeToggle = (typeId: string) => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    onTypeToggle(typeId);
  };

  const getSelectedLabel = () => {
    if (selectedTypes.length === 0) return 'Не выбрано';
    if (selectedTypes.length === STICKER_TYPES.length) return 'Все типы';
    if (selectedTypes.length === 1) {
      const type = STICKER_TYPES.find(t => t.id === selectedTypes[0]);
      return type?.label || 'Выбрано';
    }
    return `Выбрано: ${selectedTypes.length}`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Dropdown trigger button */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.35rem 0.5rem',
          borderRadius: '0.5rem',
          background: glassBase,
          backgroundColor: glassSolid,
          color: textColorResolved,
          fontSize: '0.7rem',
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
        <span>{getSelectedLabel()}</span>
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
        <Box
          sx={{
            position: 'absolute',
            top: 'calc(100% + 0.25rem)',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: bgColor,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '0.75rem',
            border: `1px solid ${borderColor}`,
            boxShadow: isLight 
              ? '0 8px 24px rgba(30, 72, 185, 0.15)' 
              : '0 8px 24px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            animation: 'fadeSlideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {STICKER_TYPES.map((type) => {
            const isSelected = selectedTypes.includes(type.id);
            return (
              <div
                key={type.id}
                onClick={() => handleTypeToggle(type.id)}
                style={{
                  padding: '0.45rem 0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = glassBase;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    border: `1.5px solid ${borderColor}`,
                    backgroundColor: isSelected ? glassHover : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <CheckIcon 
                      sx={{ 
                        fontSize: '0.7rem', 
                        color: textColorResolved,
                      }} 
                    />
                  )}
                </div>

                {/* Emoji and Label */}
                <span style={{ fontSize: '0.75rem' }}>{type.emoji}</span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: textColorResolved,
                  fontWeight: 500,
                  flex: 1,
                }}>
                  {type.label}
                </span>
              </div>
            );
          })}
        </Box>
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

