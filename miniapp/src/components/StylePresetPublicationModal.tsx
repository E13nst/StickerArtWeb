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
  hasReferenceImage?: boolean;
  hasGeneratedResult?: boolean;
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
  hasReferenceImage = false,
  hasGeneratedResult = false,
  onPublished,
  variant = 'draft_preset',
  taskId,
  userStyleBlueprintCode,
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
    if (variant === 'task_completed') {
      const codeTrimmed = (preset.code ?? '').trim().slice(0, 50);
      if (!codeTrimmed) {
        setError('Не удалось автоматически сформировать код стиля. Перезапустите создание стиля.');
        return;
      }
      if (!taskId?.trim()) {
        setError('Нет идентификатора задачи генерации.');
        return;
      }
      if (!hasReferenceImage) {
        setError('Нужна референсная фотография: добавьте фото-референс и выполните генерацию заново.');
        return;
      }
      if (!hasGeneratedResult) {
        setError('Нет результата генерации. Сначала создайте изображение, затем отправьте стиль на модерацию.');
        return;
      }
    } else {
      const hasPresetReference = Boolean(preset.presetReferenceImageUrl);
      const hasPresetPreview = Boolean(preset.previewWebpUrl ?? preset.previewUrl);
      if (!hasPresetReference) {
        setError('Нужна референсная фотография. Добавьте референс перед отправкой на модерацию.');
        return;
      }
      if (!hasPresetPreview) {
        setError('Нужно превью результата. Сгенерируйте превью перед отправкой на модерацию.');
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      if (variant === 'task_completed') {
        const codeTrimmed = (preset.code ?? '').trim().slice(0, 50);
        const updated = await apiClient.publishUserStyleFromTask(taskId!.trim(), {
          code: codeTrimmed,
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
  }, [
    preset,
    displayName,
    variant,
    taskId,
    userStyleBlueprintCode,
    hasReferenceImage,
    hasGeneratedResult,
    onPublished,
    onClose,
  ]);

  if (!preset) return null;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} className="style-preset-publish-dialog">
      <DialogTitle>Публикация в каталог</DialogTitle>
      <DialogContent>
        <section className="style-preset-publish-section">
          <h3 className="style-preset-publish-section__title">Что произойдёт после отправки</h3>
          <p className="style-preset-publish-body">{bodyText}</p>
          {variant === 'task_completed' ? (
            <p className="style-preset-publish-flow-note">
              Стиль сразу перейдёт в статус «На модерации», без сохранения в черновики.
            </p>
          ) : null}
        </section>
        {variant === 'task_completed' ? (
          <section className="style-preset-publish-section">
            <h3 className="style-preset-publish-section__title">Условия публикации</h3>
            <p className="style-preset-publish-footnote">
              Для модерации должны быть прикреплены: 1 референсное фото и результат генерации.
            </p>
          </section>
        ) : null}
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
          Нажимая кнопку подтверждения ниже, вы соглашаетесь с публикацией и с отображением результата
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
          Отправить на модерацию за {costLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
