import { ReactNode, CSSProperties, FC } from 'react';
import './Alert.css';

export type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

interface AlertProps {
  severity?: AlertSeverity;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const Alert: FC<AlertProps> = ({
  severity = 'info',
  children,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`alert alert-${severity} ${className}`}
      style={style}
      role="alert"
    >
      {children}
    </div>
  );
};
