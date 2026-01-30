import React from 'react';
import { Text } from './Text';
import './StickerCard.css';

export interface StickerCardProps {
  title: string;
  imageUrl: string;
  likes: number;
  onLikeClick?: (e: React.MouseEvent) => void;
  onCardClick?: () => void;
  className?: string;
}

export const StickerCard: React.FC<StickerCardProps> = ({
  title,
  imageUrl,
  likes,
  onLikeClick,
  onCardClick,
  className = '',
}) => {
  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick();
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLikeClick) {
      onLikeClick(e);
    }
  };

  return (
    <div
      className={`sticker-card ${className}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Header */}
      <div className="sticker-card__header">
        <Text variant="body" weight="bold" className="sticker-card__title">
          {title}
        </Text>
      </div>

      {/* Preview */}
      <div className="sticker-card__preview">
        <img
          src={imageUrl}
          alt={title}
          className="sticker-card__image"
        />
      </div>

      {/* Like Badge */}
      <button
        className="sticker-card__like-badge"
        onClick={handleLikeClick}
        aria-label={`Лайков: ${likes}`}
        type="button"
      >
        <span className="sticker-card__like-icon">❤️</span>
        <span className="sticker-card__like-count">{likes}</span>
      </button>
    </div>
  );
};

export default StickerCard;
