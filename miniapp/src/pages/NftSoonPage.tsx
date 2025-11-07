import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const NftSoonPage: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 'calc(100vh * 0.04) calc(100vw * 0.04)',
        paddingTop: 'clamp(96px, 14vh, 168px)',
        background: 'var(--tg-theme-bg-color)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          padding: 'calc(100vh * 0.04) calc(100vw * 0.04)',
          borderRadius: 'calc(100vw * 0.04)',
          textAlign: 'center',
          background: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 88%, transparent)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid color-mix(in srgb, var(--tg-theme-border-color) 60%, transparent)',
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
          NFT 2.0 Trading Soon
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

