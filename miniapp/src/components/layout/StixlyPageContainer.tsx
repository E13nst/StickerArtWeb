import React from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import './StixlyPageContainer.css';

interface StixlyPageContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const StixlyPageContainer: React.FC<StixlyPageContainerProps> = ({ 
  children, 
  className = '', 
  style,
  ...rest 
}) => {
  const { isInTelegramApp } = useTelegram();

  return (
    <div 
      className={`stixly-page-container ${isInTelegramApp ? 'telegram-mode' : 'web-mode'} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
};

