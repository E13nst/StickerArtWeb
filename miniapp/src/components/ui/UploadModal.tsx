import React, { useEffect, useRef, useCallback, useState } from 'react';
import './UploadModal.css';

export interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  title?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  className?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  title = 'Add stickers to Stixly',
  accept = 'image/*',
  multiple = true,
  maxSize = 10,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>('');

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

  // Validate files
  const validateFiles = (files: FileList | File[]): File[] => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    let errorMsg = '';

    fileArray.forEach((file) => {
      // Check file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        errorMsg = `File "${file.name}" exceeds maximum size of ${maxSize}MB`;
        return;
      }

      validFiles.push(file);
    });

    if (errorMsg) {
      setError(errorMsg);
      setTimeout(() => setError(''), 5000);
    } else {
      setError('');
    }

    return validFiles;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const validFiles = validateFiles(files);
      setSelectedFiles(validFiles);
    }
  };

  // Handle drag events
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const validFiles = validateFiles(files);
      setSelectedFiles(validFiles);
    }
  };

  // Handle upload button click
  const handleUploadClick = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
      setSelectedFiles([]);
      onClose();
    }
  };

  // Handle cancel button click
  const handleCancelClick = () => {
    setSelectedFiles([]);
    setError('');
    onClose();
  };

  // Open file picker
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus first focusable element
    const focusableElements = modal.querySelectorAll<HTMLElement>(
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

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setError('');
      setIsDragging(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="upload-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`upload-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
      >
        {/* Header */}
        <div className="upload-modal-header">
          <h2 id="upload-modal-title" className="upload-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="upload-modal-close"
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
        </div>

        {/* Content */}
        <div className="upload-modal-content">
          <p className="upload-modal-subtitle">
            Insert the link or the name of the sticker set
          </p>

          {/* Drop Zone */}
          <div
            className={`upload-drop-zone ${isDragging ? 'upload-drop-zone-active' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                openFilePicker();
              }
            }}
          >
            <div className="upload-drop-zone-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M24 8V32M24 8L16 16M24 8L32 16M8 32V36C8 38.2091 9.79086 40 12 40H36C38.2091 40 40 38.2091 40 36V32"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="upload-drop-zone-text">
              {selectedFiles.length > 0 ? (
                <>
                  <strong>{selectedFiles.length}</strong>{' '}
                  {selectedFiles.length === 1 ? 'file selected' : 'files selected'}
                </>
              ) : (
                <>
                  <strong>Drop files here</strong> or click to browse
                </>
              )}
            </div>
            {selectedFiles.length === 0 && (
              <div className="upload-drop-zone-hint">
                Supported formats: Images • Max size: {maxSize}MB
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileSelect}
            className="upload-file-input"
            aria-hidden="true"
          />

          {/* Error message */}
          {error && (
            <div className="upload-error" role="alert">
              {error}
            </div>
          )}

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="upload-files-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="upload-file-item">
                  <span className="upload-file-name">{file.name}</span>
                  <span className="upload-file-size">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="upload-modal-footer">
          <button
            type="button"
            className="upload-modal-button upload-modal-button-cancel"
            onClick={handleCancelClick}
          >
            Cancel
          </button>
          <button
            type="button"
            className="upload-modal-button upload-modal-button-upload"
            onClick={handleUploadClick}
            disabled={selectedFiles.length === 0}
          >
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
