import React, { useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const NftSoonPage: React.FC = () => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 'calc(100vh * 0.04) calc(100vw * 0.04)',
        paddingTop: 'clamp(96px, 14vh, 168px)',
        paddingBottom: 'calc(100vh * 0.08)',
        background: 'var(--tg-theme-bg-color)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: [
            'linear-gradient(90deg, color-mix(in srgb,rgb(10, 70, 45) 70%, transparent) 0 1px, transparent 1px)',
            'linear-gradient(0deg, color-mix(in srgb,rgb(15, 175, 108) 60%, transparent) 0 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: 'clamp(40px, 12vw, 96px) clamp(40px, 12vw, 96px)',
          backgroundPosition: 'center',
          opacity: 0.22,
          pointerEvents: 'none',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: [
            'linear-gradient(to top, color-mix(in srgb, var(--tg-theme-bg-color) 86%, var(--tg-theme-secondary-bg-color) 14%) 0%, color-mix(in srgb, var(--tg-theme-bg-color) 78%, var(--tg-theme-secondary-bg-color) 22%) 22%, transparent 64%)',
            'radial-gradient(circle at 50% 55%, transparent 48%, color-mix(in srgb, var(--tg-theme-bg-color) 70%, var(--tg-theme-secondary-bg-color) 30%) 74%, color-mix(in srgb, var(--tg-theme-bg-color) 88%, var(--tg-theme-secondary-bg-color) 12%) 100%)'
          ].join(', '),
          opacity: 0.5,
          pointerEvents: 'none',
          zIndex: 0,
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          zIndex: 1,
          padding: 'calc(100vh * 0.04) calc(100vw * 0.04)',
          borderRadius: 'calc(100vw * 0.04)',
          textAlign: 'center',
          backgroundColor: 'color-mix(in srgb, rgba(32, 72, 122, 0.28) 45%, rgba(15, 32, 52, 0.18))',
          border: '1px solid color-mix(in srgb, rgba(148, 198, 255, 0.42) 60%, transparent)',
          boxShadow: '0 18px 44px rgba(8, 32, 72, 0.18)',
          backdropFilter: 'blur(2px) saturate(5%)',
          WebkitBackdropFilter: 'blur(12px) saturate(5%)',
          overflow: 'hidden',
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            fontSize: 'clamp(28px, 8vw, 48px)',
            color: 'var(--tg-theme-text-color)',
            letterSpacing: '0.4px',
          }}
        >
          NFT 2.0 <br /> Trading Soon
        </Typography>
        <Typography
          variant="body1"
          sx={{
            marginTop: 'calc(100vh * 0.02)',
            fontSize: 'clamp(14px, 3.6vw, 18px)',
            color: 'var(--tg-theme-hint-color)',
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
          }}
        >
          {`Мы готовим совершенно новый торговый опыт для цифровых коллекций.
Следите за обновлениями!`}
        </Typography>
      </Paper>
    </Box>
  );
};

export default NftSoonPage;

