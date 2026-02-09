import { useState, ReactNode, FC } from 'react';
import './Tooltip.css';

interface TooltipProps {
  title: ReactNode;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: FC<TooltipProps> = ({
  title,
  children,
  placement = 'top',
  className = ''
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className={`tooltip-wrapper ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className={`tooltip tooltip-${placement}`} role="tooltip">
          {title}
        </span>
      )}
    </span>
  );
};
