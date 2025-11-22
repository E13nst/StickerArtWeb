import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTelegram } from '@/hooks/useTelegram';
import { clearNonGalleryAnimations } from '@/utils/imageLoader';

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
      document.body.classList.add('modal-open');

      return () => {
        document.body.style.overflow = originalStyle.overflow;
        document.body.classList.remove('modal-open');
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
    <Box
      onClick={handleBackdropClick}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300, // Выше чем у обычных модальных окон
        backgroundColor: getBackdropColor(),
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        animation: open 
          ? 'backdropFadeIn 300ms cubic-bezier(0.4, 0, 0.2, 1)' 
          : 'backdropFadeOut 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        willChange: 'opacity, backdrop-filter',
        transform: 'translateZ(0)', // Принудительное использование GPU
        '@keyframes backdropFadeIn': {
          '0%': {
            opacity: 0,
            backdropFilter: 'blur(0px)',
            WebkitBackdropFilter: 'blur(0px)',
          },
          '100%': {
            opacity: 1,
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
          },
        },
        '@keyframes backdropFadeOut': {
          '0%': {
            opacity: 1,
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
          },
          '100%': {
            opacity: 0,
            backdropFilter: 'blur(0px)',
            WebkitBackdropFilter: 'blur(0px)',
          },
        },
        // Адаптивность для разных размеров экрана
        '@media (max-width: 480px)': {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        },
        // Поддержка для устройств без backdrop-filter
        '@supports not (backdrop-filter: blur(15px))': {
          backgroundColor: themeParams?.colorScheme === 'dark' 
            ? 'rgba(0, 0, 0, 0.6)' 
            : 'rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      <Box
        onTouchMove={(e) => {
          // Предотвращаем сворачивание Mini App при свайпе внутри модального окна
          // События touchmove внутри модального окна не должны сворачивать приложение
          e.stopPropagation();
        }}
        sx={{
          touchAction: 'pan-y', // Разрешаем только вертикальный скролл внутри контента
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
