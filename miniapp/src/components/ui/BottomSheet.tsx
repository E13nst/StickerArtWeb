import React, { useEffect, useRef, useCallback } from 'react';
import './BottomSheet.css';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const sheet = sheetRef.current;
    if (!sheet) return;

    // Focus first focusable element
    const focusableElements = sheet.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Trap focus within modal
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="bottom-sheet-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={sheetRef}
        className={`bottom-sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
      >
        {/* Grabber */}
        <div className="bottom-sheet-grabber" aria-hidden="true">
          <div className="bottom-sheet-grabber-bar" />
        </div>

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="bottom-sheet-header">
            <div className="bottom-sheet-header-content">
              {title && (
                <h2 id="bottom-sheet-title" className="bottom-sheet-title">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  className="bottom-sheet-close"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M18 6L6 18M6 6L18 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div ref={contentRef} className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </div>
  );
};
