import React, { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { AnimatedSticker } from './AnimatedSticker';

interface TelegramStickerCardProps {
  title: string;
  description?: string;
  stickerCount: number;
  previewStickers: Array<{
    id: string;
    thumbnailUrl?: string;
    emoji?: string;
    isAnimated?: boolean;
  }>;
  onClick?: () => void;
  priority?: 'high' | 'low' | 'auto';
}

export const TelegramStickerCard: React.FC<TelegramStickerCardProps> = ({
  title,
  description,
  stickerCount,
  previewStickers,
  onClick,
  priority = 'auto',
}) => {
  const { tg } = useTelegram();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleClick = () => {
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    onClick?.();
  };

  const handleImageError = (stickerId: string) => {
    setImageErrors(prev => new Set(prev).add(stickerId));
  };

  return (
    <div className="tg-sticker-card" onClick={handleClick}>
      <div className="tg-sticker-card__preview">
        {previewStickers.slice(0, 4).map((sticker, index) => (
          <div key={sticker.id} className="tg-sticker-card__preview-item">
            {!imageErrors.has(sticker.id) && sticker.thumbnailUrl ? (
              sticker.isAnimated ? (
                <AnimatedSticker
                  fileId={sticker.id}
                  imageUrl={sticker.thumbnailUrl}
                  emoji={sticker.emoji}
                  className="tg-sticker-card__preview-img"
                />
              ) : (
                <img
                  src={sticker.thumbnailUrl}
                  alt={sticker.emoji || ''}
                  className="tg-sticker-card__preview-img"
                  onError={() => handleImageError(sticker.id)}
                  loading={priority === 'high' ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={priority}
                />
              )
            ) : (
              <div className="tg-sticker-card__preview-placeholder">
                {sticker.emoji || '🎨'}
              </div>
            )}
            {sticker.isAnimated && (
              <div className="tg-sticker-card__animated-badge">TGS</div>
            )}
          </div>
        ))}
      </div>
      <div className="tg-sticker-card__content">
        <h3 className="tg-sticker-card__title">{title}</h3>
        {description && (
          <p className="tg-sticker-card__description">{description}</p>
        )}
        <div className="tg-sticker-card__footer">
          <span className="tg-sticker-card__count">{stickerCount} стикеров</span>
          <svg className="tg-sticker-card__arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

// CSS для карточки
const styles = `
.tg-sticker-card {
  background: var(--tg-theme-secondary-bg-color);
  border-radius: var(--tg-radius-l);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: var(--tg-spacing-3);
}

.tg-sticker-card:active {
  transform: scale(0.98);
}

.tg-sticker-card__preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--tg-theme-bg-color);
  aspect-ratio: 1 / 1;
}

.tg-sticker-card__preview-item {
  position: relative;
  background: var(--tg-theme-bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  aspect-ratio: 1 / 1;
}

.tg-sticker-card__preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: var(--tg-spacing-2);
}

.tg-sticker-card__preview-placeholder {
  font-size: 56px;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--tg-theme-secondary-bg-color) 0%, var(--tg-theme-bg-color) 100%);
}

.tg-sticker-card__animated-badge {
  position: absolute;
  top: var(--tg-spacing-1);
  right: var(--tg-spacing-1);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(10px);
}

.tg-sticker-card__content {
  padding: var(--tg-spacing-4);
}

.tg-sticker-card__title {
  font-size: var(--tg-font-size-l);
  font-weight: 600;
  color: var(--tg-theme-text-color);
  margin: 0 0 var(--tg-spacing-1) 0;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tg-sticker-card__description {
  font-size: var(--tg-font-size-s);
  color: var(--tg-theme-hint-color);
  margin: 0 0 var(--tg-spacing-3) 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tg-sticker-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tg-sticker-card__count {
  font-size: var(--tg-font-size-s);
  color: var(--tg-theme-hint-color);
  font-weight: 500;
}

.tg-sticker-card__arrow {
  color: var(--tg-theme-hint-color);
  flex-shrink: 0;
}

/* Темная тема */
.tg-dark-theme .tg-sticker-card__animated-badge {
  background: rgba(255, 255, 255, 0.2);
}
`;

if (typeof document !== 'undefined') {
  const styleId = 'tg-sticker-card-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

