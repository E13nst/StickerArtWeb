import { ReactNode, CSSProperties, FC } from 'react';
import './Card.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export const Card: FC<CardProps> = ({ 
  children, 
  className = '',
  style = {},
  onClick
}) => {
  return (
    <div 
      className={`card ${className} ${onClick ? 'card-clickable' : ''}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardContentProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const CardContent: FC<CardContentProps> = ({ 
  children, 
  className = '',
  style = {}
}) => {
  return (
    <div 
      className={`card-content ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};
