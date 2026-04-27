import { FC, useCallback, useRef, ChangeEvent, DragEvent } from 'react';
import { StylePresetField } from '@/api/client';
import {
  DND_PRESET_REF_IMAGE_MIME,
  hasExternalFilesDrag,
  hasSourceStripDrag,
  parsePresetReferenceDrag,
  parseSourceStripDrag,
  type PresetReferenceMovePayload,
} from '@/components/referenceDnd';
import './PresetReferenceField.css';

export type { PresetReferenceMovePayload } from '@/components/referenceDnd';

const cn = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(' ');

const collectUniqueIds = (assignments: Record<string, string[]>): Set<string> => {
  const s = new Set<string>();
  Object.values(assignments).forEach((arr) => {
    arr.forEach((id) => {
      if (id) s.add(id);
    });
  });
  return s;
};

interface PresetReferenceFieldProps {
  field: StylePresetField;
  isFirst: boolean;
  disabled: boolean;
  assignedIds: string[];
  previewById: Record<string, string>;
  uploading: boolean;
  effectiveMaxUnique: number;
  allAssignments: Record<string, string[]>;
  onRemoveAt: (key: string, index: number) => void;
  onAddFiles: (key: string, files: File[]) => void;
  onMoveImage: (payload: PresetReferenceMovePayload & { toKey: string; toIndex: number }) => void;
  /** Перетаскивание с Source Strip: файл по индексу в исходниках */
  onAddFromSourceIndex?: (toIndex: number, sourceIndex: number) => void;
  /** Файлы с диска / проводника в слот(ы), начиная с toIndex */
  onAddExternalFilesAt?: (toIndex: number, files: File[]) => void;
}

export const PresetReferenceField: FC<PresetReferenceFieldProps> = ({
  field,
  isFirst,
  disabled,
  assignedIds,
  previewById,
  uploading,
  effectiveMaxUnique,
  allAssignments,
  onRemoveAt,
  onAddFiles,
  onMoveImage,
  onAddFromSourceIndex,
  onAddExternalFilesAt,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const maxSlot = Math.max(1, field.maxImages ?? 1);
  const minSlot = Math.max(0, field.minImages ?? 0);
  const slotFull = assignedIds.length >= maxSlot;
  const uniques = collectUniqueIds(allAssignments);
  const atGlobalCap = uniques.size >= effectiveMaxUnique;
  const canAddMore = !slotFull && uniques.size < effectiveMaxUnique;

  const openPicker = useCallback(() => {
    if (disabled || uploading || slotFull) return;
    if (uniques.size >= effectiveMaxUnique) return;
    inputRef.current?.click();
  }, [disabled, effectiveMaxUnique, slotFull, uniques.size, uploading]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length) onAddFiles(field.key, files);
  };

  const handleDragStart = (e: DragEvent, imageId: string, index: number) => {
    if (disabled) return;
    const payload: PresetReferenceMovePayload = { imageId, fromKey: field.key, fromIndex: index };
    e.dataTransfer.setData(DND_PRESET_REF_IMAGE_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const isExternalFileDrag = (e: DragEvent) => {
    return hasExternalFilesDrag(e.dataTransfer) && onAddExternalFilesAt && canAddMore;
  };

  const handleDragOver = (e: DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    if (isExternalFileDrag(e)) {
      e.dataTransfer.dropEffect = 'copy';
      return;
    }
    if (hasSourceStripDrag(e.dataTransfer)) {
      e.dataTransfer.dropEffect = onAddFromSourceIndex ? 'copy' : 'none';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDropOnCell = (e: DragEvent, toIndex: number) => {
    if (disabled) return;
    e.preventDefault();
    const fromDisk = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (fromDisk.length && onAddExternalFilesAt && canAddMore) {
      e.stopPropagation();
      onAddExternalFilesAt(toIndex, fromDisk);
      return;
    }
    const refPayload = parsePresetReferenceDrag(e.dataTransfer);
    if (refPayload) {
      onMoveImage({
        ...refPayload,
        toKey: field.key,
        toIndex,
      });
      e.stopPropagation();
      return;
    }
    if (!onAddFromSourceIndex) return;
    const sourcePayload = parseSourceStripDrag(e.dataTransfer);
    if (sourcePayload) {
      e.stopPropagation();
      onAddFromSourceIndex(toIndex, sourcePayload.sourceIndex);
    }
  };

  const cells: Array<{ kind: 'image'; id: string; index: number } | { kind: 'empty'; index: number }> = [];
  for (let i = 0; i < maxSlot; i++) {
    const id = assignedIds[i];
    if (id) {
      cells.push({ kind: 'image', id, index: i });
    } else {
      cells.push({ kind: 'empty', index: i });
    }
  }

  return (
    <div
      className={cn('preset-reference-field', 'preset-fields-form__field', isFirst && 'preset-fields-form__field--first')}
      role="group"
      aria-label={field.label}
    >
      <span className="preset-fields-form__label">
        {field.label}
        {field.required && <span className="preset-fields-form__required"> *</span>}
        <span className="preset-reference-field__limits" aria-hidden="true">
          {' '}
          ({minSlot > 0 ? `${minSlot}–` : ''}
          {maxSlot})
        </span>
      </span>
      {field.description && <p className="preset-fields-form__description">{field.description}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={maxSlot > 1}
        hidden
        onChange={handleFileChange}
      />
      <div className="preset-reference-field__grid">
        {cells.map((cell) =>
          cell.kind === 'image' ? (
            <div
              key={`${cell.id}-${cell.index}`}
              className="preset-reference-field__cell preset-reference-field__cell--filled"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnCell(e, cell.index)}
            >
              <img
                src={previewById[cell.id] ?? ''}
                alt=""
                className="preset-reference-field__thumb"
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, cell.id, cell.index)}
              />
              {!disabled && (
                <button
                  type="button"
                  className="preset-reference-field__remove"
                  onClick={() => onRemoveAt(field.key, cell.index)}
                  aria-label="Убрать из слота"
                >
                  ×
                </button>
              )}
            </div>
          ) : (
            <button
              key={`empty-${cell.index}`}
              type="button"
              className="preset-reference-field__cell preset-reference-field__cell--empty"
              disabled={disabled || uploading || !canAddMore}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnCell(e, cell.index)}
              onClick={openPicker}
              aria-label={`Добавить изображение, ячейка ${cell.index + 1}`}
            >
              {uploading ? '…' : '+'}
            </button>
          )
        )}
      </div>
      {atGlobalCap && !slotFull && (
        <p className="preset-reference-field__hint">Достигнут лимит уникальных референсов для этого стиля.</p>
      )}
    </div>
  );
};
