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
      sx={{ 
        borderRadius: 2, 
        boxShadow: '0 6px 20px rgba(0,0,0,0.1)', 
        backgroundColor: 'rgba(255,255,255,0.9)',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.12)'
        },
        ...style
      }}
      className="content-visibility-auto"
    >
      <Box sx={{ 
        aspectRatio: '1/1', 
        p: 1.5, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#F6F7F9',
        borderRadius: 1.5
      }}>
        <img
          key={idx}
          src={stickers[idx]}
          loading="lazy"
          style={{ 
            width: '88%', 
            height: '88%', 
            objectFit: 'contain', 
            transition: 'opacity 0.28s ease',
            borderRadius: '8px'
          }}
          alt="Hero sticker preview"
        />
      </Box>
    </Card>
  );
};
