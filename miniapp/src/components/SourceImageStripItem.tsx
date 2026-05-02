import { FC, useRef, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import { useOptionalAttachmentPointerDrag } from '@/components/AttachmentPointerDragContext';
import { useMatchPointerCoarse } from '@/hooks/useMatchPointerCoarse';

type Props = {
  index: number;
  preview: string;
  disabled: boolean;
  animationDelay: string;
  onNativeDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: () => void;
  onRemoveClick: (e: MouseEvent) => void;
  /** Быстрое нажатие без long-press DnD: полноразмерный просмотр (coarse pointer). На мышь — двойной клик по превью. */
  onTapExpand?: () => void;
};

const TAP_MAX_DRAG_PX = 16;
const TAP_MAX_DURATION_MS = 280;

/**
 * Миниатюра в ленте исходников: HTML5 DnD на desktop (fine pointer), long-press + Pointer на тач / coarse.
 */
export const SourceImageStripItem: FC<Props> = ({
  index,
  preview,
  disabled,
  animationDelay,
  onNativeDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemoveClick,
  onTapExpand,
}) => {
  const ptr = useOptionalAttachmentPointerDrag();
  const coarse = useMatchPointerCoarse();
  const nativeHtml5 = !disabled && !coarse;
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const tryExpandFromTap = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      tapRef.current = null;
      return;
    }
    if (!onTapExpand || !preview) return;

    const s = tapRef.current;
    tapRef.current = null;
    if (!s) return;

    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (dx * dx + dy * dy > TAP_MAX_DRAG_PX * TAP_MAX_DRAG_PX) return;

    if (Date.now() - s.t > TAP_MAX_DURATION_MS) return;
    onTapExpand();
  };

  return (
    <div
      className="generate-source-strip__item"
      style={{ animationDelay }}
      data-stixly-drop="source"
      data-source-index={String(index)}
      draggable={nativeHtml5}
      onDragStart={onNativeDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDoubleClick={(e) => {
        if (!preview || !onTapExpand || e.detail !== 2) return;
        if ((e.target as HTMLElement | null)?.closest?.('.generate-source-strip__remove')) return;
        e.preventDefault();
        onTapExpand();
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement | null)?.closest?.('.generate-source-strip__remove')) {
          tapRef.current = null;
        } else {
          tapRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        }
        if (!ptr?.enabled || !preview) return;
        ptr.onSourceItemPointerDown(e, { sourceIndex: index, previewUrl: preview });
      }}
      onPointerUp={(e) => {
        tryExpandFromTap(e);
      }}
      onPointerCancel={() => {
        tapRef.current = null;
      }}
    >
      <img
        src={preview}
        alt={`Исходное изображение ${index + 1}`}
        className="generate-source-strip__image"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
      {!disabled && (
        <button
          type="button"
          className="generate-source-strip__remove"
          onClick={onRemoveClick}
          onPointerDown={(ev) => ev.stopPropagation()}
          aria-label={`Удалить изображение ${index + 1}`}
        >
          ×
        </button>
      )}
    </div>
  );
};
