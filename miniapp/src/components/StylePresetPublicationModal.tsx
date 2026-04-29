import { FC, useCallback, useEffect, useRef, useState } from 'react';
import type { StylePreset } from '@/api/client';
import { publishStylePreset } from '@/api/stylePresets';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import './StylePresetPublicationModal.css';

export interface StylePresetPublicationModalProps {
  open: boolean;
  onClose: () => void;
  preset: StylePreset | null;
  estimatedPublicationCostArt?: number | null;
  publishUiHints?: Record<string, unknown> | null;
  onPublished?: (updated: StylePreset) => void;
}

/** Один блок текста: из uiHints или дефолт (что значит публикация). */
function pickPublicationBody(hints: Record<string, unknown> | null | undefined): string {
  if (!hints) {
    return (
      'После публикации стиль отправится на модерацию. Когда его одобрят, другие смогут использовать ваш пресет в генерации. ' +
      'Вы получаете отчисления ART по правилам сервиса за их использование. В каталоге может отображаться результат вашей генерации.'
    );
  }
  const direct = hints['publishDescription'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const nested = hints['publishModal'];
  if (nested && typeof nested === 'object') {
    const body = (nested as Record<string, unknown>)['description'];
    if (typeof body === 'string' && body.trim()) return body.trim();
    const intro = (nested as Record<string, unknown>)['intro'];
    if (typeof intro === 'string' && intro.trim()) return intro.trim();
  }
  return (
    'После публикации стиль отправится на модерацию. Когда его одобрят, другие смогут использовать ваш пресет в генерации. ' +
    'Вы получаете отчисления ART по правилам сервиса за их использование. В каталоге может отображаться результат вашей генерации.'
  );
}

export const StylePresetPublicationModal: FC<StylePresetPublicationModalProps> = ({
  open,
  onClose,
  preset,
  estimatedPublicationCostArt,
  publishUiHints,
  onPublished,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef('');

  useEffect(() => {
    if (open && preset) {
      setDisplayName(preset.name?.trim() ? preset.name.trim().slice(0, 100) : '');
      setError(null);
      idempotencyKeyRef.current = crypto.randomUUID();
    }
  }, [open, preset]);

  const costLabel =
    estimatedPublicationCostArt != null && Number.isFinite(estimatedPublicationCostArt)
      ? `${estimatedPublicationCostArt} ART`
      : '10 ART';

  const bodyText = pickPublicationBody(publishUiHints ?? undefined);

  const handleConfirm = useCallback(async () => {
    if (!preset) return;
    const name = displayName.trim();
    if (!name) {
      setError('Укажите название для каталога.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await publishStylePreset(preset.id, {
        idempotencyKey: idempotencyKeyRef.current,
        displayName: name.slice(0, 100),
        consentResultPublicShow: true,
      });
      onPublished?.(updated);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось опубликовать');
    } finally {
      setLoading(false);
    }
  }, [preset, displayName, onPublished, onClose]);

  if (!preset) return null;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} className="style-preset-publish-dialog">
      <DialogTitle>Публикация в каталог</DialogTitle>
      <DialogContent>
        <p className="style-preset-publish-body">{bodyText}</p>
        <p className="style-preset-publish-cost">
          Списание при подтверждении: <strong>{costLabel}</strong>
        </p>
        <label className="style-preset-publish-field">
          <span className="style-preset-publish-field__label">Название в каталоге</span>
          <input
            className="style-preset-publish-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            disabled={loading}
            autoComplete="off"
          />
        </label>
        <p className="style-preset-publish-footnote">
          Нажимая «Опубликовать», вы подтверждаете публикацию и согласие на отображение результата
          генерации для других пользователей на условиях сервиса.
        </p>
        {error ? (
          <p className="style-preset-publish-error" role="alert">
            {error}
          </p>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Отмена
        </Button>
        <Button variant="primary" onClick={() => void handleConfirm()} loading={loading}>
          Опубликовать за {costLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
