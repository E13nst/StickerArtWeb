import { FC, ChangeEvent } from 'react';
import { StylePresetField } from '@/api/client';
import './PresetFieldsForm.css';

interface PresetFieldsFormProps {
  fields: StylePresetField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
}

export const PresetFieldsForm: FC<PresetFieldsFormProps> = ({
  fields,
  values,
  onChange,
  disabled = false,
  fieldErrors = {},
}) => {
  if (!fields.length) return null;

  return (
    <div className="preset-fields-form">
      {fields.map((field) => {
        const value = values[field.key] ?? '';
        const error = fieldErrors[field.key];
        const hasError = !!error;

        return (
          <div key={field.key} className="preset-fields-form__field">
            <label className="preset-fields-form__label">
              {field.label}
              {field.required && <span className="preset-fields-form__required"> *</span>}
            </label>
            {field.description && (
              <p className="preset-fields-form__description">{field.description}</p>
            )}
            {field.type === 'select' && field.options?.length ? (
              <select
                className={[
                  'preset-fields-form__select',
                  hasError && 'preset-fields-form__select--error',
                ]
                  .filter(Boolean)
                  .join(' ')}
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
            ) : (
              <input
                type="text"
                className={[
                  'preset-fields-form__input',
                  hasError && 'preset-fields-form__input--error',
                ]
                  .filter(Boolean)
                  .join(' ')}
                placeholder={field.placeholder ?? ''}
                value={value}
                disabled={disabled}
                maxLength={field.maxLength ?? undefined}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(field.key, e.target.value)}
              />
            )}
            {hasError && <span className="preset-fields-form__error-msg">{error}</span>}
          </div>
        );
      })}
    </div>
  );
};
