import {
  FC,
  useCallback,
  useRef,
  useState,
  DragEvent,
  ChangeEvent,
} from 'react';
import { StylePreset } from '@/api/client';
import { uploadPresetReference } from '@/api/stylePresets';
import './PresetReferenceUpload.css';

const ALLOWED_TYPES = ['image/png', 'image/webp', 'image/jpeg'] as const;
const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return 'Поддерживаются форматы: PNG, WebP, JPEG';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Файл слишком большой (максимум 3 МБ)';
  }
  return null;
}

interface PresetReferenceUploadProps {
  preset: StylePreset;
  currentUserId: number;
  /** Вызывается после успешной загрузки с обновлённым пресетом */
  onUploaded?: (updated: StylePreset) => void;
}

/**
 * Блок загрузки референс-изображения пресета.
 *
 * Показывается только если preset.ownerId === currentUserId.
 * Поддерживает drag-and-drop и выбор через файловый диалог.
 * Отображает превью через URL.createObjectURL и прогресс-бар загрузки.
 */
export const PresetReferenceUpload: FC<PresetReferenceUploadProps> = ({
  preset,
  currentUserId,
  onUploaded,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    preset.presetReferenceImageUrl ?? null
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const currentObjectUrlRef = useRef<string | null>(null);

  const isOwner = preset.ownerId === currentUserId;

  const revokePreviousObjectUrl = useCallback(() => {
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);

      revokePreviousObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      currentObjectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
      setProgress(0);

      try {
        const updated = await uploadPresetReference(preset.id, file, {
          onProgress: (pct) => setProgress(pct),
        });

        revokePreviousObjectUrl();
        setPreviewUrl(updated.presetReferenceImageUrl ?? objectUrl);
        setProgress(null);
        onUploaded?.(updated);
      } catch (e) {
        setProgress(null);
        setError(e instanceof Error ? e.message : 'Ошибка при загрузке изображения');
        revokePreviousObjectUrl();
        setPreviewUrl(preset.presetReferenceImageUrl ?? null);
      }
    },
    [preset.id, preset.presetReferenceImageUrl, onUploaded, revokePreviousObjectUrl]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  if (!isOwner) return null;

  const isUploading = progress !== null;

  return (
    <div className="preset-ref-upload">
      <p className="preset-ref-upload__label">Референс-изображение стиля</p>

      <div
        className={[
          'preset-ref-upload__dropzone',
          isDragOver && 'preset-ref-upload__dropzone--active',
          isUploading && 'preset-ref-upload__dropzone--uploading',
        ]
          .filter(Boolean)
          .join(' ')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Перетащите изображение или нажмите для выбора"
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            inputRef.current?.click();
          }
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Референс пресета"
            className="preset-ref-upload__preview"
            draggable={false}
          />
        ) : (
          <div className="preset-ref-upload__placeholder">
            <span className="preset-ref-upload__icon">🖼️</span>
            <span className="preset-ref-upload__hint">
              Перетащите изображение<br />или нажмите для выбора
            </span>
          </div>
        )}

        {isUploading && (
          <div className="preset-ref-upload__progress-wrap" aria-label={`Загрузка: ${progress}%`}>
            <div
              className="preset-ref-upload__progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {!isUploading && (
        <p className="preset-ref-upload__formats">PNG, WebP, JPEG · до 3 МБ</p>
      )}

      {error && (
        <p className="preset-ref-upload__error" role="alert">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="preset-ref-upload__input"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};
