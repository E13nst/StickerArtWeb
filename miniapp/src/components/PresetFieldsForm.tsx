import { FC, ChangeEvent, useState, useEffect, useRef, useCallback } from 'react';
import { StylePresetField } from '@/api/client';
import { PresetReferenceField, PresetReferenceMovePayload } from '@/components/PresetReferenceField';
import './PresetFieldsForm.css';

interface PresetFieldsFormProps {
  fields: StylePresetField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  /** Список эмодзи для полей type=emoji (как в выборе стикера по умолчанию) */
  emojiOptions: string[];
  referenceAssignments?: Record<string, string[]>;
  referencePreviewById?: Record<string, string>;
  referenceUploadingKey?: string | null;
  effectiveReferenceMaxUnique?: number;
  onReferenceRemove?: (key: string, index: number) => void;
  onReferenceAddFiles?: (key: string, files: File[]) => void;
  onReferenceMove?: (payload: PresetReferenceMovePayload & { toKey: string; toIndex: number }) => void;
}

const cn = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(' ');

export const PresetFieldsForm: FC<PresetFieldsFormProps> = ({
  fields,
  values,
  onChange,
  disabled = false,
  fieldErrors = {},
  emojiOptions,
  referenceAssignments,
  referencePreviewById,
  referenceUploadingKey = null,
  effectiveReferenceMaxUnique,
  onReferenceRemove,
  onReferenceAddFiles,
  onReferenceMove,
}) => {
  const [openEmojiKey, setOpenEmojiKey] = useState<string | null>(null);
  const fieldWrapRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setFieldWrapRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) fieldWrapRefs.current[key] = el;
    else delete fieldWrapRefs.current[key];
  }, []);

  useEffect(() => {
    if (openEmojiKey == null) return;
    const handleDown = (e: MouseEvent) => {
      const el = fieldWrapRefs.current[openEmojiKey];
      if (el && !el.contains(e.target as Node)) {
        setOpenEmojiKey(null);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handleDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleDown);
    };
  }, [openEmojiKey]);

  if (!fields.length) return null;

  return (
    <div className="preset-fields-form" role="group" aria-label="Поля стиля">
      {fields.map((field, index) => {
        const value = values[field.key] ?? '';
        const error = fieldErrors[field.key];
        const hasError = !!error;
        const isFirst = index === 0;

        if (field.type === 'reference') {
          if (
            referenceAssignments == null ||
            referencePreviewById == null ||
            effectiveReferenceMaxUnique == null ||
            !onReferenceRemove ||
            !onReferenceAddFiles ||
            !onReferenceMove
          ) {
            return null;
          }
          return (
            <PresetReferenceField
              key={field.key}
              field={field}
              isFirst={isFirst}
              disabled={disabled}
              assignedIds={referenceAssignments[field.key] ?? []}
              previewById={referencePreviewById}
              uploading={referenceUploadingKey === field.key}
              effectiveMaxUnique={effectiveReferenceMaxUnique}
              allAssignments={referenceAssignments}
              onRemoveAt={onReferenceRemove}
              onAddFiles={onReferenceAddFiles}
              onMoveImage={onReferenceMove}
            />
          );
        }

        if (field.type === 'emoji') {
          return (
            <div
              key={field.key}
              ref={(el) => setFieldWrapRef(field.key, el)}
              className={cn('preset-fields-form__field', 'preset-fields-form__field--emoji', isFirst && 'preset-fields-form__field--first')}
            >
              <span className="preset-fields-form__label">
                {field.label}
                {field.required && <span className="preset-fields-form__required"> *</span>}
              </span>
              {field.description && <p className="preset-fields-form__description">{field.description}</p>}
              {field.placeholder && <p className="preset-fields-form__emoji-prompt">{field.placeholder}</p>}
              <div className="preset-fields-form__emoji-row">
                <button
                  type="button"
                  className={cn('preset-fields-form__emoji-value', hasError && 'preset-fields-form__emoji-value--error')}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setOpenEmojiKey((k) => (k === field.key ? null : field.key));
                  }}
                  aria-expanded={openEmojiKey === field.key}
                >
                  {value || '—'}
                </button>
                {openEmojiKey === field.key && (
                  <div className="preset-fields-form__emoji-dropdown" role="listbox">
                    {emojiOptions.map((em) => (
                      <button
                        key={em}
                        type="button"
                        className={cn('preset-fields-form__emoji-option', em === value && 'preset-fields-form__emoji-option--active')}
                        onClick={() => {
                          onChange(field.key, em);
                          setOpenEmojiKey(null);
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {hasError && <span className="preset-fields-form__error-msg">{error}</span>}
            </div>
          );
        }

        if (field.type === 'select' && field.options?.length) {
          return (
            <div key={field.key} className={cn('preset-fields-form__field', isFirst && 'preset-fields-form__field--first')}>
              <label className="preset-fields-form__label" htmlFor={`preset-field-${field.key}`}>
                {field.label}
                {field.required && <span className="preset-fields-form__required"> *</span>}
              </label>
              {field.description && <p className="preset-fields-form__description">{field.description}</p>}
              <select
                id={`preset-field-${field.key}`}
                className={cn('preset-fields-form__select', hasError && 'preset-fields-form__select--error')}
                value={value}
                disabled={disabled}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(field.key, e.target.value)}
              >
                <option value="">{field.placeholder ?? 'Выберите вариант'}</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {hasError && <span className="preset-fields-form__error-msg">{error}</span>}
            </div>
          );
        }

        return (
          <div key={field.key} className={cn('preset-fields-form__field', isFirst && 'preset-fields-form__field--first')}>
            <label className="preset-fields-form__label" htmlFor={`preset-field-${field.key}`}>
              {field.label}
              {field.required && <span className="preset-fields-form__required"> *</span>}
            </label>
            {field.description && <p className="preset-fields-form__description">{field.description}</p>}
            <input
              id={`preset-field-${field.key}`}
              type="text"
              className={cn('preset-fields-form__input', hasError && 'preset-fields-form__input--error')}
              placeholder={field.placeholder ?? ''}
              value={value}
              disabled={disabled}
              maxLength={field.maxLength ?? undefined}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(field.key, e.target.value)}
            />
            {hasError && <span className="preset-fields-form__error-msg">{error}</span>}
          </div>
        );
      })}
    </div>
  );
};
