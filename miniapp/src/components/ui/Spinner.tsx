import { CSSProperties, FC } from 'react';
import './Spinner.css';

interface SpinnerProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export const Spinner: FC<SpinnerProps> = ({ size = 40, className = '', style = {} }) => {
  return (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size, ...style }}
      role="status"
      aria-label="Загрузка"
    >
      <svg viewBox="0 0 24 24" className="spinner-svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="31.4 31.4" className="spinner-circle" />
      </svg>
    </span>
  );
};
