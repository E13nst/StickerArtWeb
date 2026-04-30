import { FC, useCallback, useEffect, useRef, useState } from 'react';
import type { StylePreset } from '@/api/client';
import { apiClient } from '@/api/client';
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
  /** Черновик в БД — POST …/style-presets/{id}/publish; иначе публикация из завершённой задачи */
  variant?: 'draft_preset' | 'task_completed';
  /** Для variant === task_completed */
  taskId?: string | null;
  userStyleBlueprintCode?: string | null;
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
  variant = 'draft_preset',
  taskId,
  userStyleBlueprintCode,
}) => {
  const [catalogCode, setCatalogCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef('');

  useEffect(() => {
    if (open && preset) {
      setCatalogCode((preset.code ?? '').trim().slice(0, 50));
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
    const codeTrimmed = catalogCode.trim();
    if (variant === 'task_completed') {
      if (!codeTrimmed) {
        setError('Укажите код пресета для каталога (до 50 символов).');
        return;
      }
      if (!taskId?.trim()) {
        setError('Нет идентификатора задачи генерации.');
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      if (variant === 'task_completed') {
        const updated = await apiClient.publishUserStyleFromTask(taskId!.trim(), {
          code: codeTrimmed.slice(0, 50),
          displayName: name.slice(0, 100),
          idempotencyKey: idempotencyKeyRef.current,
          consentResultPublicShow: true,
          ...(typeof userStyleBlueprintCode === 'string' && userStyleBlueprintCode.trim()
            ? { userStyleBlueprintCode: userStyleBlueprintCode.trim() }
            : {}),
        });
        onPublished?.(updated);
        onClose();
        return;
      }
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
  }, [preset, displayName, catalogCode, variant, taskId, userStyleBlueprintCode, onPublished, onClose]);

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
        {variant === 'task_completed' ? (
          <label className="style-preset-publish-field">
            <span className="style-preset-publish-field__label">Код в каталоге</span>
            <input
              className="style-preset-publish-input"
              value={catalogCode}
              onChange={(e) => setCatalogCode(e.target.value.slice(0, 50))}
              maxLength={50}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
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
