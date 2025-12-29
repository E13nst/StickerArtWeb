import React, { useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import '../styles/common.css';
import '../styles/NftSoonPage.css';

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
    <Box className="nft-soon-page">
      <Paper elevation={0} className="nft-soon-card">
        <Typography variant="h3" className="nft-soon-title">
          NFT 2.0 <br /> Trading Soon
        </Typography>
        <Typography variant="body1" className="nft-soon-description">
          {`Мы готовим совершенно новый торговый опыт для цифровых коллекций.
Следите за обновлениями!`}
        </Typography>
      </Paper>
    </Box>
  );
};

export default NftSoonPage;

