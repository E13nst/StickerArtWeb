import { FC, type DragEvent, type MouseEvent } from 'react';
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
};

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
}) => {
  const ptr = useOptionalAttachmentPointerDrag();
  const coarse = useMatchPointerCoarse();
  const nativeHtml5 = !disabled && !coarse;

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
      onPointerDown={(e) => {
        if (!ptr?.enabled || !preview) return;
        ptr.onSourceItemPointerDown(e, { sourceIndex: index, previewUrl: preview });
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
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Удалить изображение ${index + 1}`}
        >
          ×
        </button>
      )}
    </div>
  );
};
