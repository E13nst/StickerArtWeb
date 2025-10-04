import React, { useEffect, useRef, useState } from 'react';
import { Card, Box } from '@mui/material';
import { StickerPreview } from './StickerPreview';

interface HeroStickerCardProps {
  stickers: string[];
  style?: React.CSSProperties;
}

// Создаем mock стикеры для HeroStickerCard
const createMockSticker = (url: string, emoji: string, isAnimated: boolean = false) => ({
  file_id: `hero_${Date.now()}_${Math.random()}`,
  file_unique_id: `hero_unique_${Date.now()}_${Math.random()}`,
  type: 'regular' as const,
  width: 512,
  height: 512,
  is_animated: isAnimated,
  is_video: false,
  emoji: emoji,
  url: url
});

export const HeroStickerCard: React.FC<HeroStickerCardProps> = ({ stickers, style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active || stickers.length < 2) return;
    const id = setInterval(() => setIdx(i => (i + 1) % stickers.length), 2200);
    return () => clearInterval(id);
  }, [active, stickers]);

  if (stickers.length === 0) return null;

  return (
    <Card 
      ref={ref} 
      className="glass-card content-visibility-auto"
      sx={{ 
        borderRadius: 2,
        boxShadow: 'none',
        backgroundColor: 'transparent',
        p: 0,
        ...style
      }}
    >
      <Box sx={{ 
        aspectRatio: '1/1', 
        p: 1.5, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>
        <StickerPreview
          key={idx}
          sticker={createMockSticker(stickers[idx], '🎨', stickers[idx].includes('lottie'))}
          size="large"
          showBadge={false}
          isInTelegramApp={false}
        />
      </Box>
    </Card>
  );
};
