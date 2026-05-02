import { FC, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DownloadIcon } from '@/components/ui/Icons';
import './GenerateImageLightbox.css';

export type GenerateImageLightboxProps = {
  open: boolean;
  imageUrl: string;
  alt?: string;
  onClose: () => void;
  onDownload?: () => void;
  downloadDisabled?: boolean;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SNAP_BELOW = 1.05;

const touchDist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

type TVals = { scale: number; tx: number; ty: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const GenerateImageLightbox: FC<GenerateImageLightboxProps> = ({
  open,
  imageUrl,
  alt = '',
  onClose,
  onDownload,
  downloadDisabled = false,
}) => {
  const pinchRootRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const valsRef = useRef<TVals>({ scale: MIN_SCALE, tx: 0, ty: 0 });

  const pinchRef = useRef<{ initialDist: number; initialScale: number } | null>(null);
  const panRef = useRef<{ ax: number; ay: number; tx0: number; ty0: number } | null>(null);

  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);

  const clampPan = useCallback((scale: number, tx: number, ty: number) => {
    const root = pinchRootRef.current;
    if (!root || scale <= MIN_SCALE) return { tx: 0, ty: 0 };
    const { clientWidth: cw, clientHeight: ch } = root;
    const maxX = Math.max(0, (cw * (scale - 1)) / 2 + 48);
    const maxY = Math.max(0, (ch * (scale - 1)) / 2 + 48);
    return { tx: clamp(tx, -maxX, maxX), ty: clamp(ty, -maxY, maxY) };
  }, []);

  const apply = useCallback(() => {
    const node = transformRef.current;
    if (!node) return;
    const { scale, tx, ty } = valsRef.current;
    node.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  }, []);

  const reset = useCallback(() => {
    valsRef.current = { scale: MIN_SCALE, tx: 0, ty: 0 };
    apply();
  }, [apply]);

  useEffect(() => {
    if (!open) return;
    pinchRef.current = null;
    panRef.current = null;
    lastTapRef.current = null;
    reset();
  }, [open, imageUrl, reset]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const el = pinchRootRef.current;
    if (!el) return undefined;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => apply());
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          initialDist: touchDist(e.touches[0]!, e.touches[1]!),
          initialScale: valsRef.current.scale,
        };
        panRef.current = null;
      } else if (e.touches.length === 1 && valsRef.current.scale > MIN_SCALE + 0.02) {
        const t = e.touches[0]!;
        panRef.current = {
          ax: t.clientX,
          ay: t.clientY,
          tx0: valsRef.current.tx,
          ty0: valsRef.current.ty,
        };
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const { initialDist, initialScale } = pinchRef.current;
        if (initialDist < 1) return;
        const d = touchDist(e.touches[0]!, e.touches[1]!);
        const nextScale = clamp(initialScale * (d / initialDist), MIN_SCALE, MAX_SCALE);
        const p = clampPan(nextScale, valsRef.current.tx, valsRef.current.ty);
        valsRef.current.scale = nextScale;
        valsRef.current.tx = p.tx;
        valsRef.current.ty = p.ty;
        schedule();
      } else if (e.touches.length === 1 && panRef.current) {
        e.preventDefault();
        const t = e.touches[0]!;
        const { ax, ay, tx0, ty0 } = panRef.current;
        const nx = tx0 + (t.clientX - ax);
        const ny = ty0 + (t.clientY - ay);
        const p = clampPan(valsRef.current.scale, nx, ny);
        valsRef.current.tx = p.tx;
        valsRef.current.ty = p.ty;
        schedule();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        pinchRef.current = null;
        panRef.current = null;

        /** Двойной тап: сброс или ~2× */
        const reducedMotion =
          typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const t = e.changedTouches[0];
        if (!reducedMotion && t) {
          const now = performance.now();
          const prev = lastTapRef.current;
          lastTapRef.current = { t: now, x: t.clientX, y: t.clientY };
          if (
            prev &&
            now - prev.t < 300 &&
            Math.hypot(t.clientX - prev.x, t.clientY - prev.y) < 22
          ) {
            lastTapRef.current = null;
            if (valsRef.current.scale <= MIN_SCALE + 0.06) {
              const z = clamp(2, MIN_SCALE, MAX_SCALE);
              const p = clampPan(z, 0, 0);
              valsRef.current = { scale: z, tx: p.tx, ty: p.ty };
            } else {
              valsRef.current = { scale: MIN_SCALE, tx: 0, ty: 0 };
            }
            schedule();
          }
        }

        if (valsRef.current.scale < SNAP_BELOW) {
          valsRef.current = { scale: MIN_SCALE, tx: 0, ty: 0 };
          schedule();
        }
      }

      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
      if (e.touches.length === 0) {
        panRef.current = null;
      }

      schedule();
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.009);
      const next = clamp(valsRef.current.scale * k, MIN_SCALE, MAX_SCALE);
      const p = clampPan(next, valsRef.current.tx, valsRef.current.ty);
      valsRef.current.scale = next;
      valsRef.current.tx = p.tx;
      valsRef.current.ty = p.ty;
      schedule();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [open, apply, clampPan]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="generate-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Полноразмерное изображение"
      onClick={onClose}
    >
      <button
        type="button"
        className="generate-image-lightbox__close"
        aria-label="Закрыть"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
      {onDownload ? (
        <button
          type="button"
          className="generate-image-lightbox__download"
          aria-label="Скачать изображение"
          disabled={downloadDisabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!downloadDisabled) onDownload();
          }}
        >
          <DownloadIcon size={22} />
        </button>
      ) : null}
      <div
        className="generate-image-lightbox__stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div ref={pinchRootRef} className="generate-image-lightbox__pinch-root" onClick={(e) => e.stopPropagation()}>
          <div ref={transformRef} className="generate-image-lightbox__transform">
            <img src={imageUrl} alt={alt} className="generate-image-lightbox__img" draggable={false} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
