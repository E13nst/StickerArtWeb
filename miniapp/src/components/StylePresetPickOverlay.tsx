import { FC, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StylePreset } from '@/api/client';
import { onApiHostedImageError } from '@/utils/apiImageFallback';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import './StylePresetPickOverlay.css';

export interface StylePresetPickOverlayProps {
  preset: StylePreset | null;
  onAccept: () => void;
  onDismiss: () => void;
}

const pickPreviewUrl = (p: StylePreset): string | null =>
  (p.previewWebpUrl ?? p.previewUrl ?? p.presetReferenceImageUrl)?.trim?.() ??
  null;

/** Оверлей выбора стиля после тапа по сетке: slide-in справа, принять / пропустить. */
export const StylePresetPickOverlay: FC<StylePresetPickOverlayProps> = ({ preset, onAccept, onDismiss }) => {
  const open = preset != null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onDismiss();
    },
    [open, onDismiss],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const name = preset?.name?.replace(/\s*\(.*?\)\s*$/g, '').trim() || 'Стиль';

  return (
    <AnimatePresence>
      {open && preset ? (
        <motion.div
          key={preset.id}
          className="style-preset-pick-overlay"
          aria-modal="true"
          role="dialog"
          aria-label="Выбор стиля"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button type="button" className="style-preset-pick-overlay__backdrop" onClick={onDismiss} aria-label="Закрыть" />

          <motion.div
            className="style-preset-pick-overlay__sheet"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.32 }}
          >
            <div className="style-preset-pick-overlay__header">
              <Text variant="h2" weight="bold">
                Выбрать стиль?
              </Text>
              <Text variant="bodySmall" color="secondary" className="style-preset-pick-overlay__subtitle">
                Свайпы в генерации горизонтальные на hero-карте; здесь можно подтвердить или отложить выбор со сетки.
              </Text>
            </div>

            <div className="style-preset-pick-overlay__media">
              {pickPreviewUrl(preset) ? (
                <img
                  src={pickPreviewUrl(preset)!}
                  alt=""
                  draggable={false}
                  className="style-preset-pick-overlay__img"
                  onError={onApiHostedImageError}
                />
              ) : (
                <div className="style-preset-pick-overlay__placeholder" aria-hidden />
              )}
            </div>

            <Text variant="body" weight="semibold" align="center" className="style-preset-pick-overlay__title">
              {name}
            </Text>
            {preset.description ? (
              <Text variant="bodySmall" color="secondary" align="center" className="style-preset-pick-overlay__desc">
                {preset.description}
              </Text>
            ) : null}

            <div className="style-preset-pick-overlay__actions">
              <Button variant="outline" size="medium" onClick={onDismiss}>
                Отменить
              </Button>
              <Button variant="primary" size="medium" onClick={onAccept}>
                Применить
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
