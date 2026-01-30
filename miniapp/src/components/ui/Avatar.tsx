import React from 'react';
import './Avatar.css';

interface AvatarProps {
  src?: string;
  alt?: string;
  children?: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  alt = '', 
  children, 
  size = 40,
  style = {},
  className = ''
}) => {
  return (
    <div 
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        ...style
      }}
    >
      {src ? (
        <img src={src} alt={alt} className="avatar-img" />
      ) : (
        <span className="avatar-initials">{children}</span>
      )}
    </div>
  );
};
