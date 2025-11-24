import React from 'react';
import { Container, ContainerProps } from '@mui/material';
import { useTelegram } from '@/hooks/useTelegram';

export const StixlyPageContainer: React.FC<ContainerProps> = ({ children, sx, ...rest }) => {
  const { isInTelegramApp } = useTelegram();

  return (
    <Container
      maxWidth={isInTelegramApp ? 'sm' : 'lg'}
      sx={{ px: 2, pb: 2, ...sx }}
      {...rest}
    >
      {children}
    </Container>
  );
};

