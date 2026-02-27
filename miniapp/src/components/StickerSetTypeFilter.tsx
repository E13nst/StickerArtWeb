import { FC } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import './StickerSetTypeFilter.css';

export type StickerSetType = 'USER' | 'OFFICIAL';

interface StickerSetTypeFilterProps {
  selectedTypes: StickerSetType[];
  onTypeToggle: (type: StickerSetType) => void;
  disabled?: boolean;
}

// SVG Icons
const CheckedIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"></polyline>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
  </svg>
);

const UncheckedIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  </svg>
);

export const StickerSetTypeFilter: FC<StickerSetTypeFilterProps> = ({
  selectedTypes,
  onTypeToggle,
  disabled = false
}) => {
  const { tg } = useTelegram();
  const textColorResolved = 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = 'rgba(88, 138, 255, 0.20)';
  const glassSolid = 'rgba(78, 132, 255, 0.20)';
  const borderColor = 'rgba(118, 168, 255, 0.24)';

  const types: { value: StickerSetType; label: string }[] = [
    { value: 'USER', label: 'Пользовательские' },
    { value: 'OFFICIAL', label: 'Официальные' }
  ];

  const handleTypeClick = (type: StickerSetType) => {
    if (disabled) return;
    
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
    onTypeToggle(type);
  };

  return (
    <div className="sticker-set-type-filter">
      <div 
        className="sticker-set-type-filter__title"
        style={{ color: textColorResolved }}
      >
        Тип сетов
      </div>

      <div className="sticker-set-type-filter__options">
        {types.map((type) => {
          const isSelected = selectedTypes.includes(type.value);

          return (
            <button
              key={type.value}
              onClick={() => handleTypeClick(type.value)}
              disabled={disabled}
              className={`sticker-set-type-filter__option ${isSelected ? 'sticker-set-type-filter__option--selected' : ''}`}
              style={{
                backgroundColor: glassSolid,
                background: glassBase,
                borderColor: borderColor,
                color: textColorResolved,
              }}
            >
              <span className="sticker-set-type-filter__icon">
                {isSelected ? <CheckedIcon /> : <UncheckedIcon />}
              </span>
              <span className="sticker-set-type-filter__label">
                {type.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
