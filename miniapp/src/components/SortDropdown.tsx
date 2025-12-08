import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTelegram } from '../hooks/useTelegram';

interface SortDropdownProps {
  sortByLikes: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const SORT_OPTIONS = [
  { id: 'likes', label: 'Самые популярные', emoji: '❤️', value: true },
  { id: 'new', label: 'Новые', emoji: '🔥', value: false },
];

export const SortDropdown: React.FC<SortDropdownProps> = ({
  sortByLikes,
  onToggle,
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

  const handleToggleMenu = () => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    setIsOpen(!isOpen);
  };

  const handleSortSelect = (newValue: boolean) => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    // Only toggle if the value is different
    if (sortByLikes !== newValue) {
      onToggle();
    }
    setIsOpen(false);
  };

  const currentOption = SORT_OPTIONS.find(opt => opt.value === sortByLikes);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Dropdown trigger button */}
      <button
        onClick={handleToggleMenu}
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
          gap: '0.5rem',
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
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{currentOption?.emoji}</span>
          <span>{currentOption?.label || 'Новые'}</span>
        </span>
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
            zIndex: 'var(--z-dropdown, 300)',
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
          {SORT_OPTIONS.map((option) => {
            const isSelected = sortByLikes === option.value;
            return (
              <div
                key={option.id}
                onClick={() => handleSortSelect(option.value)}
                style={{
                  padding: '0.45rem 0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  backgroundColor: isSelected ? glassBase : 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = glassBase;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected ? glassBase : 'transparent';
                }}
              >
                {/* Emoji and Label */}
                <span style={{ fontSize: '0.85rem' }}>{option.emoji}</span>
                <span style={{ 
                  fontSize: '0.7rem', 
                  color: textColorResolved,
                  fontWeight: isSelected ? 600 : 500,
                  flex: 1,
                }}>
                  {option.label}
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

