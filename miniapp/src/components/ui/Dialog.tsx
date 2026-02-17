import { ReactNode, CSSProperties, FC, MouseEvent, useEffect, useState } from 'react';
import './Dialog.css';

const DIALOG_CLOSE_ANIMATION_MS = 350;

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  'data-modal-content'?: boolean;
}

export const Dialog: FC<DialogProps> = ({
  open,
  onClose,
  children,
  className = '',
  style = {},
  'data-modal-content': dataModalContent
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
    } else if (isVisible) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, DIALOG_CLOSE_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!isVisible) return null;

  const backdropClass = [
    'dialog-backdrop',
    open && !isClosing ? 'dialog-backdrop--open' : '',
    isClosing ? 'dialog-backdrop--closing' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={backdropClass}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClosing) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`dialog-paper ${className}`}
        style={style}
        data-modal-content={dataModalContent !== false ? true : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const DialogTitle: FC<DialogTitleProps> = ({ children, className = '', style = {} }) => (
  <h2 className={`dialog-title ${className}`} style={style}>{children}</h2>
);

interface DialogContentProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export const DialogContent: FC<DialogContentProps> = ({ children, className = '', style = {}, onClick }) => (
  <div className={`dialog-content ${className}`} style={style} onClick={onClick}>{children}</div>
);

interface DialogActionsProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export const DialogActions: FC<DialogActionsProps> = ({ children, className = '', style = {}, onClick }) => (
  <div className={`dialog-actions ${className}`} style={style} onClick={onClick}>{children}</div>
);
