import { ReactNode, CSSProperties, FC } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import './StixlyPageContainer.css';

interface StixlyPageContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const StixlyPageContainer: FC<StixlyPageContainerProps> = ({ 
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

