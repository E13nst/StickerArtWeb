import { memo, FC } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import './AddStickerPackButton.css';

interface AddStickerPackButtonProps {
  onClick: () => void;
  variant?: 'gallery' | 'profile';
}

const AddStickerPackButtonComponent: FC<AddStickerPackButtonProps> = ({ onClick, variant = 'gallery' }) => {
  const { tg } = useTelegram();
  const handleClick = () => { tg?.HapticFeedback?.impactOccurred('light'); onClick(); };

  const textColorResolved = 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = 'color-mix(in srgb, rgba(88, 138, 255, 0.36) 60%, transparent)';
  const glassSolid = 'rgba(78, 132, 255, 0.24)';
  const borderColor = 'rgba(118, 168, 255, 0.28)';

  if (variant === 'gallery') {
    return (
      <button 
        onClick={handleClick} 
        className="add-sticker-pack-button add-sticker-pack-button--gallery"
        style={{
          backgroundColor: glassSolid,
          background: glassBase,
          borderColor: borderColor,
          color: textColorResolved,
        }}
      >
        <span className="add-sticker-pack-button__plus">+</span>
        <span>Добавить</span>
        <span 
          className="add-sticker-pack-button__badge"
          style={{
            backgroundColor: glassSolid,
            borderColor: borderColor,
          }}
        >
          +10 ART
        </span>
      </button>
    );
  }

  return (
    <div className="add-sticker-pack-button-wrapper">
      <button 
        onClick={handleClick} 
        className="add-sticker-pack-button add-sticker-pack-button--profile"
        style={{
          backgroundColor: glassSolid,
          background: glassBase,
          borderColor: borderColor,
          color: textColorResolved,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Добавьте стикерпак</span>
        <span 
          className="add-sticker-pack-button__badge"
          style={{
            backgroundColor: 'rgba(135, 182, 255, 0.24)',
          }}
        >
          +10 ART
        </span>
      </button>
    </div>
  );
};

export const AddStickerPackButton = memo(AddStickerPackButtonComponent);
