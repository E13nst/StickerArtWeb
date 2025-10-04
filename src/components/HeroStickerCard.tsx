import React, { useEffect, useRef, useState } from 'react';
import { Card, Box } from '@mui/material';

interface HeroStickerCardProps {
  stickers: string[];
  style?: React.CSSProperties;
}

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
        <img
          key={idx}
          src={stickers[idx]}
          loading="lazy"
          className="sticker-img"
          style={{ 
            width: '88%', 
            height: '88%', 
            objectFit: 'contain', 
            transition: 'opacity 0.28s ease'
          }}
          alt="Hero sticker preview"
        />
      </Box>
    </Card>
  );
};
