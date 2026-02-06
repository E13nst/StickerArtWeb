import React from 'react';
import { Navbar } from '@/components/ui/Navbar';
import './BottomNav.css';

interface BottomNavProps {
  activeTab?: number;
  onChange?: (newValue: number) => void;
  isInTelegramApp?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = () => {
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);

  // Проверяем, открыто ли модальное окно
  React.useEffect(() => {
    const checkModalState = () => {
      const hasModalOpen = document.body.classList.contains('modal-open') || 
                          document.documentElement.classList.contains('modal-open');
      setIsModalOpen(hasModalOpen);
    };

    // Проверяем сразу
    checkModalState();

    // Создаем MutationObserver для отслеживания изменений классов
    const observer = new MutationObserver(checkModalState);
    
    // Наблюдаем за изменениями в body и html
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Скрываем навигацию, если модальное окно открыто
  if (isModalOpen) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="home-indicator-area" aria-hidden="true">
        <div className="home-indicator" />
      </div>
    </>
  );
};
