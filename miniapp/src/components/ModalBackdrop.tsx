import React, { useEffect, useState } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { clearNonGalleryAnimations } from '@/utils/imageLoader';
import './ModalBackdrop.css';

interface ModalBackdropProps {
  open: boolean;
  children: React.ReactNode;
  onClose?: () => void;
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({ open, children, onClose }) => {
  const { themeParams } = useTelegram();
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

  // Определяем цвет затемнения в зависимости от темы
  const getBackdropColor = () => {
    const isDark = themeParams?.colorScheme === 'dark';
    
    if (isDark) {
      // Для темной темы - более светлое затемнение с меньшей непрозрачностью
      return 'rgba(255, 255, 255, 0.08)';
    } else {
      // Для светлой темы - более темное затемнение с меньшей непрозрачностью
      return 'rgba(0, 0, 0, 0.4)';
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Клик по самому backdrop (области выше/ниже модалки) закрывает окно
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className={`modal-backdrop ${open ? 'modal-backdrop--open' : ''}`}
      style={{
        backgroundColor: getBackdropColor()
      }}
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
