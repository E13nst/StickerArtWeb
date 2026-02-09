import { ReactNode, CSSProperties, FC } from 'react';
import './IconButton.css';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  style?: CSSProperties;
  'aria-label': string;
}

export const IconButton: FC<IconButtonProps> = ({
  children,
  size = 'medium',
  className = '',
  style = {},
  ...rest
}) => {
  return (
    <button
      type="button"
      className={`icon-button icon-button-${size} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </button>
  );
};
