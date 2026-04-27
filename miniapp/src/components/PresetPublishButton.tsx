import { FC, useCallback, useRef, useState } from 'react';
import { StylePreset } from '@/api/client';
import { publishStylePreset } from '@/api/stylePresets';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import './PresetPublishButton.css';

type ModerationStatus = NonNullable<StylePreset['moderationStatus']>;

const STATUS_LABELS: Record<ModerationStatus, string> = {
  DRAFT: 'Черновик',
  PENDING_MODERATION: 'На модерации',
  APPROVED: 'Опубликован',
  REJECTED: 'Отклонён',
};

const STATUS_CSS: Record<ModerationStatus, string> = {
  DRAFT: 'preset-status--draft',
  PENDING_MODERATION: 'preset-status--pending',
  APPROVED: 'preset-status--approved',
  REJECTED: 'preset-status--rejected',
};

interface ModerationStatusBadgeProps {
  status: ModerationStatus;
}

/** Бейдж статуса модерации пресета. */
export const ModerationStatusBadge: FC<ModerationStatusBadgeProps> = ({ status }) => (
  <span className={`preset-status ${STATUS_CSS[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

interface PresetPublishButtonProps {
  preset: StylePreset;
  currentUserId: number;
  /** Вызывается после успешной публикации с обновлённым пресетом */
  onPublished?: (updated: StylePreset) => void;
}

/**
 * Кнопка публикации пресета.
 *
 * Показывается только если:
 *   – preset.isGlobal === false
 *   – preset.ownerId === currentUserId
 *   – preset.moderationStatus === 'DRAFT'
 *
 * Перед отправкой показывает диалог подтверждения.
 * Использует idempotencyKey (crypto.randomUUID()) для безопасного ретрая.
 */
export const PresetPublishButton: FC<PresetPublishButtonProps> = ({
  preset,
  currentUserId,
  onPublished,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>('');

  const canPublish =
    !preset.isGlobal &&
    preset.ownerId === currentUserId &&
    preset.moderationStatus === 'DRAFT';

  const handleOpenDialog = useCallback(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
    setError(null);
    setDialogOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await publishStylePreset(preset.id, idempotencyKeyRef.current);
      setDialogOpen(false);
      onPublished?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось опубликовать пресет');
    } finally {
      setIsLoading(false);
    }
  }, [preset.id, onPublished]);

  const handleClose = useCallback(() => {
    if (!isLoading) setDialogOpen(false);
  }, [isLoading]);

  if (!canPublish) return null;

  return (
    <>
      <button
        className="preset-publish-btn"
        onClick={handleOpenDialog}
        type="button"
        aria-label="Опубликовать пресет"
      >
        Опубликовать
      </button>

      <Dialog open={dialogOpen} onClose={handleClose}>
        <DialogTitle>Опубликовать пресет?</DialogTitle>
        <DialogContent>
          <p className="preset-publish-dialog__text">
            Публикация спишет <strong>10 ART</strong> и отправит пресет{' '}
            <strong>«{preset.name}»</strong> на модерацию.
          </p>
          {error && (
            <p className="preset-publish-dialog__error" role="alert">
              {error}
            </p>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={isLoading}>
            Продолжить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
