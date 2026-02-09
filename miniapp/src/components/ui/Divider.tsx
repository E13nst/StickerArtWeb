import { CSSProperties, FC } from 'react';
import './Divider.css';

interface DividerProps {
  className?: string;
  style?: CSSProperties;
}

export const Divider: FC<DividerProps> = ({ className = '', style = {} }) => {
  return <hr className={`divider ${className}`} style={style} />;
};
