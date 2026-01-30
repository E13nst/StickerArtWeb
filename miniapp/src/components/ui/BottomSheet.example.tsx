import React, { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

/**
 * BottomSheet Component Example
 * 
 * Демонстрирует использование компонента BottomSheet
 * для отображения контента снизу экрана
 */

export const BottomSheetExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  return (
    <div style={{ padding: '20px' }}>
      <h2>BottomSheet Example</h2>
      <Button onClick={handleOpen}>Open BottomSheet</Button>

      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Gallery">
        <div style={{ padding: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  backgroundColor: '#333',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                Photo {i + 1}
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

/**
 * BottomSheet with Custom Content
 */
export const BottomSheetCustomContentExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ padding: '20px' }}>
      <h2>BottomSheet with Custom Content</h2>
      <Button onClick={() => setIsOpen(true)}>Open Settings</Button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Settings"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0' }}>Notifications</h3>
            <p style={{ margin: 0, color: '#8a8a8a' }}>
              Enable push notifications
            </p>
          </div>
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0' }}>Theme</h3>
            <p style={{ margin: 0, color: '#8a8a8a' }}>Dark mode enabled</p>
          </div>
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0' }}>Language</h3>
            <p style={{ margin: 0, color: '#8a8a8a' }}>English</p>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

/**
 * BottomSheet without Title
 */
export const BottomSheetNoTitleExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ padding: '20px' }}>
      <h2>BottomSheet without Title</h2>
      <Button onClick={() => setIsOpen(true)}>Open Menu</Button>

      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            style={{
              padding: '16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '8px',
            }}
            onClick={() => setIsOpen(false)}
          >
            Share
          </button>
          <button
            style={{
              padding: '16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '8px',
            }}
            onClick={() => setIsOpen(false)}
          >
            Edit
          </button>
          <button
            style={{
              padding: '16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#e03131',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '8px',
            }}
            onClick={() => setIsOpen(false)}
          >
            Delete
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
