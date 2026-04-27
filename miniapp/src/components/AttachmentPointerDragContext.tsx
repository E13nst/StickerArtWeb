import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useTelegram } from '@/hooks/useTelegram';
import type { PresetReferenceMovePayload } from '@/components/referenceDnd';
import './AttachmentPointerDragContext.css';

const MOVE_CANCEL_PX = 12;
const LONG_PRESS_MS = 400;

type DraggingPayload =
  | { kind: 'ref'; data: PresetReferenceMovePayload; previewUrl: string }
  | { kind: 'source'; sourceIndex: number; previewUrl: string };

type DropTarget =
  | { type: 'preset'; fieldKey: string; slotIndex: number }
  | { type: 'source'; sourceIndex: number };

const findDropTarget = (x: number, y: number): DropTarget | null => {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const t = el.closest('[data-stixly-drop]');
  if (!t) return null;
  const d = t.getAttribute('data-stixly-drop');
  if (d === 'preset') {
    const fieldKey = t.getAttribute('data-field-key') ?? '';
    const slotRaw = t.getAttribute('data-slot-index');
    if (!fieldKey || slotRaw == null) return null;
    const slotIndex = parseInt(slotRaw, 10);
    if (Number.isNaN(slotIndex) || slotIndex < 0) return null;
    return { type: 'preset', fieldKey, slotIndex };
  }
  if (d === 'source') {
    const s = t.getAttribute('data-source-index');
    if (s == null) return null;
    const sourceIndex = parseInt(s, 10);
    if (Number.isNaN(sourceIndex) || sourceIndex < 0) return null;
    return { type: 'source', sourceIndex };
  }
  return null;
};

const shouldStartCustomDrag = (e: ReactPointerEvent | PointerEvent): boolean => {
  if (e.button !== 0) return false;
  if (e.pointerType === 'touch' || e.pointerType === 'pen') return true;
  if (e.pointerType === 'mouse' && typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return true;
  }
  return false;
};

type PointerDragContextValue = {
  onRefCellPointerDown: (
    e: ReactPointerEvent,
    args: { imageId: string; fromKey: string; fromIndex: number; previewUrl: string },
  ) => void;
  onSourceItemPointerDown: (e: ReactPointerEvent, args: { sourceIndex: number; previewUrl: string }) => void;
  enabled: boolean;
};

const Ctx = createContext<PointerDragContextValue | null>(null);

export function useOptionalAttachmentPointerDrag(): PointerDragContextValue | null {
  return useContext(Ctx);
}

type OnDispatch = (e: { drag: DraggingPayload; target: DropTarget | null; clientX: number; clientY: number }) => void;

type ProviderProps = {
  children: ReactNode;
  enabled: boolean;
  onInternalDrop: OnDispatch;
};

type DragSession =
  | {
      kind: 'pending';
      pointerId: number;
      startX: number;
      startY: number;
      timer: ReturnType<typeof setTimeout> | null;
    }
  | {
      kind: 'active';
      pointerId: number;
      payload: DraggingPayload;
      captureEl: HTMLElement | null;
    };

export function AttachmentPointerDragProvider({ children, enabled, onInternalDrop }: ProviderProps) {
  const { tg } = useTelegram();
  const [ghost, setGhost] = useState<{ x: number; y: number; src: string } | null>(null);
  const dragStateRef = useRef<DragSession | null>(null);

  const setGhostState = (g: { x: number; y: number; src: string } | null) => {
    setGhost(g);
  };

  const endDrag = useCallback(
    (clientX: number, clientY: number) => {
      const active = dragStateRef.current;
      dragStateRef.current = null;
      setGhostState(null);
      document.body.classList.remove('stixly-attachment-pointer-active');
      if (!active || active.kind !== 'active') return;
      const target = findDropTarget(clientX, clientY);
      onInternalDrop({ drag: active.payload, target, clientX, clientY });
    },
    [onInternalDrop],
  );

  const onPointerDownRef = useCallback(
    (e: ReactPointerEvent, args: { imageId: string; fromKey: string; fromIndex: number; previewUrl: string }) => {
      if (!enabled) return;
      if (!shouldStartCustomDrag(e)) return;
      if ((e.target as HTMLElement | null)?.closest?.('button[aria-label="Убрать из слота"]')) {
        return;
      }

      const { imageId, fromKey, fromIndex, previewUrl } = args;
      if (!previewUrl) return;

      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      const pl: DraggingPayload = { kind: 'ref', data: { imageId, fromKey, fromIndex }, previewUrl };

      const timer = window.setTimeout(() => {
        const pend = dragStateRef.current;
        if (pend?.kind !== 'pending' || pend.pointerId !== pointerId) return;
        try {
          tg?.HapticFeedback?.impactOccurred?.('light');
        } catch {
          /* empty */
        }
        dragStateRef.current = { kind: 'active', pointerId, payload: pl, captureEl: el };
        setGhostState({ x: pend.startX, y: pend.startY, src: previewUrl });
        try {
          el.setPointerCapture(pointerId);
        } catch {
          /* empty */
        }
        document.body.classList.add('stixly-attachment-pointer-active');
      }, LONG_PRESS_MS);

      dragStateRef.current = { kind: 'pending', pointerId, startX, startY, timer };
    },
    [enabled, tg],
  );

  const onPointerDownSource = useCallback(
    (e: ReactPointerEvent, args: { sourceIndex: number; previewUrl: string }) => {
      if (!enabled) return;
      if (!shouldStartCustomDrag(e)) return;
      if ((e.target as HTMLElement | null)?.closest?.('.generate-source-strip__remove')) {
        return;
      }

      const { sourceIndex, previewUrl } = args;
      if (!previewUrl) return;

      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      const pl: DraggingPayload = { kind: 'source', sourceIndex, previewUrl };

      const timer = window.setTimeout(() => {
        const pend = dragStateRef.current;
        if (pend?.kind !== 'pending' || pend.pointerId !== pointerId) return;
        try {
          tg?.HapticFeedback?.impactOccurred?.('light');
        } catch {
          /* empty */
        }
        dragStateRef.current = { kind: 'active', pointerId, payload: pl, captureEl: el };
        setGhostState({ x: pend.startX, y: pend.startY, src: previewUrl });
        try {
          el.setPointerCapture(pointerId);
        } catch {
          /* empty */
        }
        document.body.classList.add('stixly-attachment-pointer-active');
      }, LONG_PRESS_MS);

      dragStateRef.current = { kind: 'pending', pointerId, startX, startY, timer };
    },
    [enabled, tg],
  );

  useEffect(() => {
    if (!enabled) {
      if (dragStateRef.current?.kind === 'pending' && dragStateRef.current.timer) {
        clearTimeout(dragStateRef.current.timer);
      }
      const cur = dragStateRef.current;
      if (cur?.kind === 'active') {
        const pid = cur.pointerId;
        const cap = cur.captureEl;
        try {
          if (cap) cap.releasePointerCapture(pid);
        } catch {
          /* empty */
        }
      }
      dragStateRef.current = null;
      setGhostState(null);
      document.body.classList.remove('stixly-attachment-pointer-active');
    }
  }, [enabled]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const st = dragStateRef.current;
      if (!st) return;

      if (st.kind === 'pending') {
        if (e.pointerId !== st.pointerId) return;
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
          if (st.timer) clearTimeout(st.timer);
          dragStateRef.current = null;
        }
        return;
      }

      if (st.kind === 'active' && e.pointerId === st.pointerId) {
        e.preventDefault();
        setGhostState({ x: e.clientX, y: e.clientY, src: st.payload.previewUrl });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = dragStateRef.current;
      if (!st) return;
      if (e.pointerId !== st.pointerId) return;

      if (st.kind === 'pending') {
        if (st.timer) clearTimeout(st.timer);
        dragStateRef.current = null;
        return;
      }

      e.preventDefault();
      const cap = st.captureEl;
      try {
        if (cap) cap.releasePointerCapture(e.pointerId);
      } catch {
        /* empty */
      }
      endDrag(e.clientX, e.clientY);
    };

    const onPointerCancel = (e: PointerEvent) => {
      const st = dragStateRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      if (st.kind === 'pending' && st.timer) clearTimeout(st.timer);
      if (st.kind === 'active') {
        try {
          if (st.captureEl) st.captureEl.releasePointerCapture(e.pointerId);
        } catch {
          /* empty */
        }
      }
      document.body.classList.remove('stixly-attachment-pointer-active');
      dragStateRef.current = null;
      setGhostState(null);
    };

    const preventScrollWhileActive = (ev: TouchEvent) => {
      if (dragStateRef.current?.kind === 'active') {
        ev.preventDefault();
      }
    };

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    document.addEventListener('touchmove', preventScrollWhileActive, { passive: false, capture: true });
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
      document.removeEventListener('touchmove', preventScrollWhileActive, { capture: true } as const);
    };
  }, [endDrag, enabled]);

  const value = useMemo<PointerDragContextValue>(
    () => ({
      onRefCellPointerDown: (e, args) => onPointerDownRef(e, args),
      onSourceItemPointerDown: (e, args) => onPointerDownSource(e, args),
      enabled: !!enabled,
    }),
    [enabled, onPointerDownRef, onPointerDownSource],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        ghost &&
        createPortal(
          <div
            className="stixly-attachment-pointer-ghost"
            style={{ left: ghost.x, top: ghost.y }}
            role="presentation"
            aria-hidden
          >
            <img src={ghost.src} alt="" className="stixly-attachment-pointer-ghost__img" draggable={false} />
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

export type { DraggingPayload, DropTarget };
