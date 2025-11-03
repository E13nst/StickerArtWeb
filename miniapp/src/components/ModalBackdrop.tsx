import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTelegram } from '@/hooks/useTelegram';

interface ModalBackdropProps {
  open: boolean;
  children: React.ReactNode;
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({ open, children }) => {
  const { themeParams } = useTelegram();
  const [isVisible, setIsVisible] = useState(false);

  // Управление видимостью с задержкой для плавной анимации
  useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Блокируем скролл body при открытии модального окна
  useEffect(() => {
    if (open) {
      // Сохраняем текущую позицию скролла
      const scrollY = window.scrollY;
      
      const originalStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        width: document.body.style.width,
        height: document.body.style.height,
        top: document.body.style.top,
      };

      // Устанавливаем top для сохранения позиции скролла
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.top = `-${scrollY}px`;

      return () => {
        // Восстанавливаем стили
        document.body.style.overflow = originalStyle.overflow;
        document.body.style.position = originalStyle.position;
        document.body.style.width = originalStyle.width;
        document.body.style.height = originalStyle.height;
        document.body.style.top = originalStyle.top;
        
        // Восстанавливаем позицию скролла
        window.scrollTo(0, scrollY);
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

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300, // Выше чем у обычных модальных окон
        backgroundColor: getBackdropColor(),
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
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
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          },
        },
        '@keyframes backdropFadeOut': {
          '0%': {
            opacity: 1,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          },
          '100%': {
            opacity: 0,
            backdropFilter: 'blur(0px)',
            WebkitBackdropFilter: 'blur(0px)',
          },
        },
        // Адаптивность для разных размеров экрана
        '@media (max-width: 480px)': {
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        },
        // Поддержка для устройств без backdrop-filter
        '@supports not (backdrop-filter: blur(6px))': {
          backgroundColor: themeParams?.colorScheme === 'dark' 
            ? 'rgba(0, 0, 0, 0.6)' 
            : 'rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      {children}
    </Box>
  );
};
