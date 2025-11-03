import { useState, useCallback, useEffect } from 'react';

interface UseModalStateOptions {
  onOpen?: () => void;
  onClose?: () => void;
  preventBodyScroll?: boolean;
}

export const useModalState = (initialOpen = false, options: UseModalStateOptions = {}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  const { onOpen, onClose, preventBodyScroll = true } = options;

  // Управление анимацией
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Блокировка скролла body
  useEffect(() => {
    if (!preventBodyScroll) return;

    if (isOpen) {
      const originalStyle = {
        overflow: document.body.style.overflow,
      };

      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalStyle.overflow;
      };
    }
  }, [isOpen, preventBodyScroll]);

  const openModal = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggleModal = useCallback(() => {
    if (isOpen) {
      closeModal();
    } else {
      openModal();
    }
  }, [isOpen, openModal, closeModal]);

  return {
    isOpen,
    isAnimating,
    openModal,
    closeModal,
    toggleModal,
  };
};
