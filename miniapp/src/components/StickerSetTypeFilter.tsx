import React from 'react';
import { Box } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { useTelegram } from '../hooks/useTelegram';

export type StickerSetType = 'USER' | 'OFFICIAL';

interface StickerSetTypeFilterProps {
  selectedTypes: StickerSetType[];
  onTypeToggle: (type: StickerSetType) => void;
  disabled?: boolean;
}

export const StickerSetTypeFilter: React.FC<StickerSetTypeFilterProps> = ({
  selectedTypes,
  onTypeToggle,
  disabled = false
}) => {
  const { tg } = useTelegram();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;
  
  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.28)' : 'rgba(88, 138, 255, 0.20)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.42)' : 'rgba(78, 132, 255, 0.20)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.38)' : 'rgba(98, 150, 255, 0.34)';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.52)' : 'rgba(118, 168, 255, 0.24)';

  const types: { value: StickerSetType; label: string }[] = [
    { value: 'USER', label: 'Пользовательские' },
    { value: 'OFFICIAL', label: 'Официальные' }
  ];

  const handleTypeClick = (type: StickerSetType) => {
    if (disabled) return;
    
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    onTypeToggle(type);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      {/* Title */}
      <Box
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          color: textColorResolved,
          opacity: 0.7,
          paddingLeft: '0.25rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Тип стикерсетов
      </Box>

      {/* Checkboxes */}
      {types.map((type) => {
        const isSelected = selectedTypes.includes(type.value);

        return (
          <Box
            key={type.value}
            onClick={() => handleTypeClick(type.value)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.5rem',
              borderRadius: '0.5rem',
              background: glassBase,
              backgroundColor: glassSolid,
              border: `1px solid ${borderColor}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: disabled ? 0.5 : 0.85,
              backdropFilter: 'blur(12px) saturate(150%)',
              WebkitBackdropFilter: 'blur(12px) saturate(150%)',
              '&:hover': disabled ? {} : {
                background: glassHover,
                backgroundColor: glassHover,
                opacity: 1,
                transform: 'scale(0.98)',
              },
              userSelect: 'none',
            }}
          >
            {/* Checkbox icon */}
            {isSelected ? (
              <CheckBoxIcon
                sx={{
                  fontSize: '1.1rem',
                  color: textColorResolved,
                  opacity: 0.9,
                }}
              />
            ) : (
              <CheckBoxOutlineBlankIcon
                sx={{
                  fontSize: '1.1rem',
                  color: textColorResolved,
                  opacity: 0.6,
                }}
              />
            )}

            {/* Label */}
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 500,
                color: textColorResolved,
                opacity: isSelected ? 0.95 : 0.75,
              }}
            >
              {type.label}
            </span>
          </Box>
        );
      })}
    </Box>
  );
};

