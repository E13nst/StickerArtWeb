import { CSSProperties, FC } from 'react';
import './Input.css';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  className?: string;
  style?: CSSProperties;
}

export const Input: FC<InputProps> = ({
  label,
  error = false,
  helperText,
  fullWidth = false,
  size = 'medium',
  className = '',
  style,
  id,
  ...rest
}) => {
  const inputId = id || (label ? `input-${label.replace(/\s/g, '-')}` : undefined);
  return (
    <div
      className={`input-wrapper ${fullWidth ? 'input-fullWidth' : ''} ${className}`}
      style={style}
    >
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input input-${size} ${error ? 'input-error' : ''}`}
        aria-invalid={error}
        aria-describedby={helperText ? `${inputId}-helper` : undefined}
        {...rest}
      />
      {helperText && (
        <span id={inputId ? `${inputId}-helper` : undefined} className={`input-helper ${error ? 'input-helper-error' : ''}`}>
          {helperText}
        </span>
      )}
    </div>
  );
};
