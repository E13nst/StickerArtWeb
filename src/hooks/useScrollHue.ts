import { useEffect } from 'react';

export function useScrollHue(min = 180, max = 260) {
  useEffect(() => {
    let ticking = false;
    const root = document.documentElement;

    const update = () => {
      ticking = false;
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || window.pageYOffset || 0;
      const scrollHeight = doc.scrollHeight - doc.clientHeight || 1;
      const t = Math.min(1, Math.max(0, scrollTop / scrollHeight));
      const hue = Math.round(min + (max - min) * t);    // линейная интерполяция тона
      root.style.setProperty('--h', String(hue));
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();                    // выставить стартовое значение
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [min, max]);
}
