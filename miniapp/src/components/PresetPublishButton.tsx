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
  /** Оценка стоимости публикации в ART (иначе показываем «10 ART»). */
  estimatedPublicationCostArt?: number | null;
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
 * Перед отправкой показывает диалог: название в каталоге, согласие, стоимость.
 * Использует idempotencyKey (crypto.randomUUID()) для безопасного ретрая.
 */
export const PresetPublishButton: FC<PresetPublishButtonProps> = ({
  preset,
  currentUserId,
  estimatedPublicationCostArt,
  onPublished,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [consent, setConsent] = useState(false);

  const idempotencyKeyRef = useRef<string>('');

  const canPublish =
    !preset.isGlobal &&
    preset.ownerId === currentUserId &&
    preset.moderationStatus === 'DRAFT';

  const costLabel =
    estimatedPublicationCostArt != null && Number.isFinite(estimatedPublicationCostArt)
      ? `${estimatedPublicationCostArt} ART`
      : '10 ART';

  const handleOpenDialog = useCallback(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
    setDisplayName(preset.name?.trim() ? preset.name.trim().slice(0, 100) : '');
    setConsent(false);
    setError(null);
    setDialogOpen(true);
  }, [preset.name]);

  const handleConfirm = useCallback(async () => {
    const name = displayName.trim();
    if (!name) {
      setError('Укажите название для каталога.');
      return;
    }
    if (!consent) {
      setError('Нужно согласие на публикацию.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const updated = await publishStylePreset(preset.id, {
        idempotencyKey: idempotencyKeyRef.current,
        displayName: name.slice(0, 100),
        consentResultPublicShow: true,
      });
      setDialogOpen(false);
      onPublished?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось опубликовать пресет');
    } finally {
      setIsLoading(false);
    }
  }, [preset.id, displayName, consent, onPublished]);

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
            Публикация отправляет пресет на модерацию и спишет <strong>{costLabel}</strong>.
          </p>
          <label className="preset-publish-dialog__field">
            <span className="preset-publish-dialog__label">Название в каталоге</span>
            <input
              className="preset-publish-dialog__input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              disabled={isLoading}
            />
          </label>
          <label className="preset-publish-dialog__consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={isLoading}
            />
            <span>
              Я согласен(на), что после модерации другие смогут использовать этот пресет, а результат
              генераций может быть виден в каталоге.
            </span>
          </label>
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
          <Button variant="primary" onClick={() => void handleConfirm()} loading={isLoading}>
            Продолжить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
