import React from 'react';
import { Container, ContainerProps } from '@mui/material';
import { useTelegram } from '@/hooks/useTelegram';

export const StixlyPageContainer: React.FC<ContainerProps> = ({ children, sx, ...rest }) => {
  const { isInTelegramApp } = useTelegram();

  return (
    <Container
      maxWidth={isInTelegramApp ? 'sm' : 'lg'}
      sx={{ 
        px: 0, 
        pb: 0, 
        pt: 0,
        mt: 0,
        mb: 0,
        '&.MuiContainer-root': {
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
          marginTop: 0,
          marginBottom: 0,
        },
        ...sx 
      }}
      {...rest}
    >
      {children}
    </Container>
  );
};

