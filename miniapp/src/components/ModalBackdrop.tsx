import { useEffect, useState, ReactNode, FC, MouseEvent } from 'react';
import { clearNonGalleryAnimations } from '@/utils/imageLoader';
import './ModalBackdrop.css';

interface ModalBackdropProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
}

export const ModalBackdrop: FC<ModalBackdropProps> = ({ open, children, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Управление видимостью с задержкой для плавной анимации
  useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      
      // Очищаем кеш анимаций после закрытия модального окна
      clearNonGalleryAnimations();
      
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Блокируем скролл body и добавляем класс для паузы анимаций при открытии модального окна
  useEffect(() => {
    if (open) {
      const originalStyle = {
        overflow: document.body.style.overflow,
      };

      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open', 'modal-lock');
      document.documentElement.classList.add('modal-open', 'modal-lock');

      return () => {
        document.body.style.overflow = originalStyle.overflow;
        document.body.classList.remove('modal-open', 'modal-lock');
        document.documentElement.classList.remove('modal-open', 'modal-lock');
      };
    }
  }, [open]);

  if (!isVisible) return null;

  const handleBackdropClick = (e: MouseEvent) => {
    // Клик по самому backdrop (области выше/ниже модалки) закрывает окно
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`modal-backdrop ${open ? 'modal-backdrop--open' : ''}`}
    >
      <div
        className="modal-backdrop-content"
        onTouchMove={(e) => {
          // Предотвращаем сворачивание Mini App при свайпе внутри модального окна
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
};
