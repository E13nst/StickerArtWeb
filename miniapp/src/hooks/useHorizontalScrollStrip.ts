import { useEffect, RefObject } from 'react';

type Options = {
  /** Перетаскивание зажатой ЛКМ (как слайдер). На лентах с HTML5 DnD лучше false. */
  pointerDrag?: boolean;
  disabled?: boolean;
};

const DRAG_THRESHOLD_PX = 6;

/**
 * Горизонтальный скролл ленты: Shift+колесо, либо жест трекпада с |deltaX| > |deltaY|.
 * Вертикальное колесо без Shift не перехватываем — иначе курсор над лентой блокирует
 * прокрутку страницы (форма генерации, кнопка снизу). Пан-скролл мышью — опционально.
 */
export function useHorizontalScrollStrip(
  ref: RefObject<HTMLElement | null>,
  options: Options = {},
): void {
  const { pointerDrag = true, disabled = false } = options;

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (el.scrollWidth <= el.clientWidth) return;

      const maxLeft = el.scrollWidth - el.clientWidth;
      const prev = el.scrollLeft;

      let d = 0;
      if (e.shiftKey) {
        d = e.deltaY;
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        d = e.deltaX;
      } else {
        // Вертикальная прокрутка мыши — не превращаем в горизонтальную, иначе страница
        // не крутится, пока курсор над лентой (см. GeneratePage, кнопка «Сгенерировать»).
        return;
      }

      if (d === 0) return;

      const next = Math.max(0, Math.min(maxLeft, prev + d));
      if (next === prev) return;
      e.preventDefault();
      el.scrollLeft = next;
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    if (!pointerDrag) {
      return () => {
        el.removeEventListener('wheel', onWheel);
      };
    }

    let startX = 0;
    let startScroll = 0;
    let active = false;
    let pointerId: number | null = null;
    let dragMoved = false;

    const isInteractiveTarget = (t: EventTarget | null) => {
      if (!(t instanceof Element)) return false;
      const d = t.closest?.('[draggable="true"]');
      if (d) return true;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return true;
      return false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      if (e.pointerType === 'touch') return;
      if (isInteractiveTarget(e.target)) return;

      startX = e.clientX;
      startScroll = el.scrollLeft;
      active = true;
      pointerId = e.pointerId;
      dragMoved = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active || pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      if (!dragMoved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      if (!dragMoved) {
        dragMoved = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* empty */
        }
        el.classList.add('horizontal-strip--dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }
      e.preventDefault();
      el.scrollLeft = startScroll - dx;
    };

    const endDrag = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      active = false;
      if (pointerId != null) {
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          /* empty */
        }
      }
      pointerId = null;
      el.classList.remove('horizontal-strip--dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.classList.remove('horizontal-strip--dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [ref, disabled, pointerDrag]);
}
