import { useEffect, useState, useRef, useCallback, ReactNode, FC } from 'react';
import { imageLoader } from '@/utils/imageLoader';
import './ModalBackdrop.css';

interface ModalBackdropProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  /** Без размытия фона (как панель фильтров) */
  noBlur?: boolean;
  /** Бэкдроп не перекрывает header и нижний navbar */
  keepNavbarVisible?: boolean;
}

// 350ms — перекрывает окно синтетических click после touchend (~300ms); визуально transition 300ms
export const CLOSE_ANIMATION_MS = 350;

// Задержка снятия классов с body/html после размонтирования (300–400 ms, чтобы не сбить плавную анимацию)
const RELEASE_LOCK_DELAY_MS = 300;

// Флаг для useTelegram: не применять тему в течение MODAL_CLOSE_GUARD_MS после закрытия модалки
export const MODAL_CLOSE_GUARD_MS = 450;
declare global {
  interface Window {
    __stixlyModalJustClosed?: number;
  }
}

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

function startFlickerDebugObserver() {
  if (typeof document === 'undefined' || !document.body) return;
  const win = typeof window !== 'undefined' ? window : null;
  const dev = import.meta.env?.DEV;
  const enabled = dev && typeof localStorage !== 'undefined' && localStorage.getItem('stixly_flicker_debug') === '1';
  if (!enabled) return;
  const obs = new MutationObserver((list) => {
    list.forEach((m) => {
      const target = m.target as Node;
      const name = target === document.body ? 'body' : target === document.documentElement ? 'documentElement' : (target as Element).className || (target as Element).id || 'unknown';
      console.log('[flicker] mutation', performance.now().toFixed(1), name, m.attributeName, m.oldValue ?? '(none)');
    });
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'], attributeOldValue: true });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'], attributeOldValue: true });
  if (win) {
    win.setTimeout(() => {
      obs.disconnect();
      console.log('[flicker] observer stopped after 1.5s');
    }, 1500);
  }
}

function releaseModalLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const overflowToRestore = savedOverflow;
    window.__stixlyModalJustClosed = Date.now();
    startFlickerDebugObserver();
    const doRemove = () => {
      if (lockCount === 0) {
        document.body.style.overflow = overflowToRestore;
        document.body.classList.remove('modal-open', 'modal-lock');
        document.documentElement.classList.remove('modal-open', 'modal-lock');
      }
      window.setTimeout(() => {
        delete window.__stixlyModalJustClosed;
      }, MODAL_CLOSE_GUARD_MS);
    };
    // Фиксированная задержка 280ms даёт браузеру время завершить перерисовку после размонтирования;
    // уменьшает мерцание при закрытии свайпом (в т.ч. в Safari, где requestIdleCallback нет).
    window.setTimeout(doRemove, RELEASE_LOCK_DELAY_MS);
  }
}

export const ModalBackdrop: FC<ModalBackdropProps> = ({ open, children, onClose, noBlur, keepNavbarVisible }) => {
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
        imageLoader.clear();
        // Откладываем размонтирование на следующий кадр, чтобы последний кадр
        // анимации (opacity: 0) успел отрисоваться — иначе при медленном закрытии экран мерцает
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVisible(false);
            setIsClosing(false);
          });
        });
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
      className={`modal-backdrop ${open ? 'modal-backdrop--open' : ''} ${isClosing ? 'modal-backdrop--closing' : ''} ${noBlur ? 'modal-backdrop--no-blur' : ''} ${keepNavbarVisible ? 'modal-backdrop--keep-navbar' : ''}`}
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
