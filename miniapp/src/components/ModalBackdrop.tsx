import { useEffect, useState, useRef, useCallback, ReactNode, FC } from 'react';
import { clearNonGalleryAnimations } from '@/utils/imageLoader';
import './ModalBackdrop.css';

interface ModalBackdropProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
}

// 350ms — гарантированно перекрывает окно синтетических click-событий (~300ms после touchend)
export const CLOSE_ANIMATION_MS = 350;

// --- Ref-count: body.modal-open держится, пока хотя бы один ModalBackdrop виден ---
let lockCount = 0;
let savedOverflow = '';

function acquireModalLock() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open', 'modal-lock');
    document.documentElement.classList.add('modal-open', 'modal-lock');
  }
  lockCount++;
}

function releaseModalLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.classList.remove('modal-open', 'modal-lock');
    document.documentElement.classList.remove('modal-open', 'modal-lock');
  }
}

export const ModalBackdrop: FC<ModalBackdropProps> = ({ open, children, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const backdropPressedRef = useRef(false);

  // Управление видимостью и анимацией закрытия
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
    } else if (isVisible) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        clearNonGalleryAnimations();
        setIsVisible(false);
        setIsClosing(false);
      }, CLOSE_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Блокируем скролл body и добавляем класс для паузы анимаций.
  // Привязано к isVisible (а не open), чтобы блокировка держалась во время анимации закрытия (350ms).
  // Ref-count: при вложенных ModalBackdrop (CategoriesDialog внутри StickerPackModal)
  // классы снимаются только когда последний backdrop закрывается.
  useEffect(() => {
    if (isVisible) {
      acquireModalLock();
      return () => releaseModalLock();
    }
  }, [isVisible]);

  const isOutsideModal = useCallback((target: EventTarget | null) => {
    return target instanceof HTMLElement && !target.closest('[data-modal-content]');
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const outside = isOutsideModal(e.target);
    backdropPressedRef.current = outside;
    // На touch-устройствах подавляем синтетический click (~300ms после touchend),
    // иначе он пройдёт сквозь уже размонтированную модалку к элементам галереи
    if (outside && e.pointerType === 'touch') {
      e.preventDefault();
    }
  }, [isOutsideModal]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (!backdropPressedRef.current) return;
    backdropPressedRef.current = false;
    if (isClosing || !onClose) return;
    if (isOutsideModal(e.target)) {
      e.preventDefault();
      onClose();
    }
  }, [isClosing, onClose, isOutsideModal]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    backdropPressedRef.current = false;
    if (isClosing || !onClose) return;
    if (isOutsideModal(e.target)) {
      e.preventDefault();
      onClose();
    }
  }, [isClosing, onClose, isOutsideModal]);

  if (!isVisible) return null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onTouchStart={(e) => { e.stopPropagation(); if (isOutsideModal(e.target)) e.preventDefault(); }}
      onTouchEnd={(e) => { e.stopPropagation(); if (isOutsideModal(e.target)) e.preventDefault(); }}
      className={`modal-backdrop ${open ? 'modal-backdrop--open' : ''} ${isClosing ? 'modal-backdrop--closing' : ''}`}
    >
      <div
        className="modal-backdrop-content"
        onTouchMove={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
