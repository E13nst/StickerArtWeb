import { ReactNode, CSSProperties, FC } from 'react';
import './Chip.css';

interface ChipProps {
  label: ReactNode;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

export const Chip: FC<ChipProps> = ({ 
  label, 
  size = 'medium',
  variant = 'filled',
  style = {},
  className = '',
  onClick
}) => {
  return (
    <span 
      className={`chip chip-${size} chip-${variant} ${className} ${onClick ? 'chip-clickable' : ''}`}
      style={style}
      onClick={onClick}
    >
      {label}
    </span>
  );
};
