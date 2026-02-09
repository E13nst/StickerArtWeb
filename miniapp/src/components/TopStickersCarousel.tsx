import { useEffect, FC } from 'react';
import { Text } from '@/components/ui/Text';
import { imageLoader, getCachedStickerUrl, LoadPriority } from '@/utils/imageLoader';

interface Sticker {
  id: number | string;
  image?: string;
  emoji?: string;
  likes: number;
  name: string;
  fileId?: string;
  url?: string;
}

interface TopStickersCarouselProps {
  stickers: Sticker[];
  onStickerClick?: (sticker: Sticker) => void;
}

export const TopStickersCarousel: FC<TopStickersCarouselProps> = ({
  stickers,
  onStickerClick
}) => {
  useEffect(() => {
    stickers.forEach(sticker => {
      if (sticker.url && sticker.fileId) {
        imageLoader.loadImage(sticker.fileId, sticker.url, LoadPriority.TIER_3_ADDITIONAL)
          .catch(() => {});
      }
    });
  }, [stickers]);

  return (
    <div style={{ width: '100%' }}>
      <Text variant="h4" weight="bold" style={{ color: 'var(--tg-theme-text-color)', marginBottom: '16px', fontSize: '1.25rem' }}>
        ТОП-5 СТИКЕРОВ
      </Text>
      
      <div
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '16px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--tg-theme-hint-color) transparent'
        }}
        className="top-stickers-scroll"
      >
        {stickers.map((sticker, index) => (
          <div
            key={sticker.id}
            onClick={() => onStickerClick?.(sticker)}
            style={{
              flex: '0 0 auto',
              width: '120px',
              textAlign: 'center',
              cursor: onStickerClick ? 'pointer' : 'default',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => onStickerClick && (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '8px', backgroundColor: 'var(--tg-theme-secondary-bg-color)', border: '1px solid var(--tg-theme-border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', overflow: 'hidden', position: 'relative' }}>
              {sticker.url && sticker.fileId ? (
                <img
                  src={getCachedStickerUrl(sticker.fileId) || sticker.url}
                  alt={sticker.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : sticker.emoji ? (
                <span style={{ fontSize: '3rem' }}>{sticker.emoji}</span>
              ) : (
                <span style={{ fontSize: '1.5rem', color: 'var(--tg-theme-hint-color)' }}>🎨</span>
              )}
              
              {/* Бейдж места */}
              <div style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {index + 1}
              </div>
            </div>
            
            <Text variant="caption" style={{ color: 'var(--tg-theme-text-color)', fontSize: '0.75rem', fontWeight: 500, display: 'block', marginBottom: '4px'}}>
              {sticker.name}
            </Text>
            
            <Text variant="caption" style={{ color: 'var(--tg-theme-hint-color)', fontSize: '0.7rem' }}>
              {sticker.likes} ❤️
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
};
