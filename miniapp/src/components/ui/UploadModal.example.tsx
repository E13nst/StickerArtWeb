import React, { useState } from 'react';
import { UploadModal } from './UploadModal';
import { Button } from './Button';

/**
 * UploadModal Component Example
 * 
 * Демонстрирует использование компонента UploadModal
 * для загрузки файлов
 */

export const UploadModalExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleUpload = (files: File[]) => {
    console.log('Uploaded files:', files);
    // Здесь можно обработать загруженные файлы
    alert(`Uploaded ${files.length} file(s): ${files.map(f => f.name).join(', ')}`);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>UploadModal Example</h2>
      <Button onClick={() => setIsOpen(true)}>Open Upload Modal</Button>

      <UploadModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
};

/**
 * UploadModal with Custom Settings
 */
export const UploadModalCustomExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleUpload = (files: File[]) => {
    console.log('Uploaded stickers:', files);
    alert(`Uploaded ${files.length} sticker(s)`);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>UploadModal with Custom Settings</h2>
      <Button onClick={() => setIsOpen(true)}>Add Stickers</Button>

      <UploadModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUpload={handleUpload}
        title="Add stickers to Stixly"
        accept="image/png,image/jpeg,image/webp"
        multiple={true}
        maxSize={5}
      />
    </div>
  );
};

/**
 * UploadModal Single File
 */
export const UploadModalSingleFileExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleUpload = (files: File[]) => {
    console.log('Uploaded file:', files[0]);
    alert(`Uploaded: ${files[0].name}`);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>UploadModal Single File</h2>
      <Button onClick={() => setIsOpen(true)}>Upload Avatar</Button>

      <UploadModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUpload={handleUpload}
        title="Upload Profile Picture"
        accept="image/*"
        multiple={false}
        maxSize={2}
      />
    </div>
  );
};

/**
 * UploadModal with Different File Types
 */
export const UploadModalDifferentTypesExample: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleUpload = (files: File[]) => {
    console.log('Uploaded documents:', files);
    alert(`Uploaded ${files.length} document(s)`);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>UploadModal for Documents</h2>
      <Button onClick={() => setIsOpen(true)}>Upload Documents</Button>

      <UploadModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onUpload={handleUpload}
        title="Upload Documents"
        accept=".pdf,.doc,.docx,.txt"
        multiple={true}
        maxSize={20}
      />
    </div>
  );
};
