import { useEffect, useState } from 'react';

/**
 * (pointer: coarse) — в основном телефон/планшет, в т.ч. в Chrome Device Toolbar.
 * Для HTML5 DnD на десктопе оставляем нативный путь, для coarse — long-press + Pointer.
 */
export function useMatchPointerCoarse(): boolean {
  const [m, setM] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(pointer: coarse)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(pointer: coarse)');
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    f();
    return () => mq.removeEventListener('change', f);
  }, []);
  return m;
}
