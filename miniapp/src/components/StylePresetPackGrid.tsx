import { FC } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { StylePreset } from '@/api/client';
import './PackCard.css';
import './StylePresetPackGrid.css';

interface StylePresetPackGridProps {
  presets: StylePreset[];
  selectedPresetId: number | null;
  onPresetChange: (presetId: number | null) => void;
  previewByPresetId?: Map<number, string>;
  onHistoryPreviewError?: (presetId: number) => void;
  fallbackPreviewByPresetCode?: Partial<Record<string, string>>;
  disabled?: boolean;
  /** Поток «свой стиль» по blueprint с бэка: подсветка «+», когда выбран пресет из этого флоу */
  creationHighlightPresetId?: number | null;
  /** Запуск флоу «Создать свой стиль» (GET blueprints, без модалки публикации) */
  onCreatePreset?: () => void;
  emptyStateText?: string | null;
}

type PresetGridOption = {
  id: number | null;
  name: string;
  code?: string;
  historyPreviewUrl?: string | null;
  previewUrl?: string | null;
  moderationStatus?: StylePreset['moderationStatus'] | null;
  isGlobal?: boolean;
};

const getServerPreviewUrl = (preset: StylePreset): string | null =>
  preset.previewWebpUrl ?? preset.previewUrl ?? null;

const stripPresetName = (name: string) =>
  name.replace(/\s*Sticker\s*/gi, ' ').replace(/\s*Style\s*/gi, ' ').replace(/\s+/g, ' ').trim();

/**
 * Вертикальная сетка пресетов в визуальном стиле галереи (pack-card):
 * 2 колонки, gap 8px, превью object-fit: contain как у PackCard.
 */
export const StylePresetPackGrid: FC<StylePresetPackGridProps> = ({
  presets,
  selectedPresetId,
  onPresetChange,
  previewByPresetId,
  onHistoryPreviewError,
  fallbackPreviewByPresetCode,
  disabled = false,
  creationHighlightPresetId = null,
  onCreatePreset,
  emptyStateText = null,
}) => {
  const { tg } = useTelegram();

  const options: PresetGridOption[] = presets.map((p) => ({
      id: p.id,
      name: stripPresetName(p.name),
      code: p.code,
      historyPreviewUrl: previewByPresetId?.get(p.id) ?? null,
      previewUrl:
        previewByPresetId?.get(p.id) ??
        getServerPreviewUrl(p) ??
        (p.code ? fallbackPreviewByPresetCode?.[p.code] : undefined),
      moderationStatus: p.moderationStatus ?? null,
      isGlobal: p.isGlobal,
    }));

  const handleSelect = (presetId: number | null) => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    onPresetChange(presetId);
  };

  return (
    <div
      className="preset-grid optimized-gallery optimized-gallery--gallery"
      role="listbox"
      aria-label="Стиль генерации"
    >
      <div className="preset-grid__row optimized-gallery__row-grid">
        <button
          type="button"
          className={[
            'preset-grid__create-btn',
            creationHighlightPresetId != null &&
              selectedPresetId === creationHighlightPresetId &&
              'preset-grid__create-btn--active',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            if (onCreatePreset) {
              onCreatePreset();
              return;
            }
            handleSelect(null);
          }}
          disabled={disabled}
        >
          + Создать свой стиль
        </button>
        {options.length === 0 && emptyStateText ? (
          <div className="preset-grid__empty-state" role="status" aria-live="polite">
            {emptyStateText}
          </div>
        ) : null}
        {options.map((opt) => {
          const isSelected = selectedPresetId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={disabled}
              className={[
                'preset-grid__card',
                'pack-card',
                isSelected && 'preset-grid__card--selected',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSelect(isSelected ? null : opt.id)}
            >
              <div className="pack-card__content">
                {opt.previewUrl ? (
                  <img
                    src={opt.previewUrl}
                    alt=""
                    className="pack-card-image"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onError={() => {
                      if (
                        opt.id != null &&
                        opt.historyPreviewUrl &&
                        opt.previewUrl &&
                        opt.previewUrl === opt.historyPreviewUrl
                      ) {
                        onHistoryPreviewError?.(opt.id);
                      }
                    }}
                  />
                ) : (
                  <div className="pack-card__placeholder" aria-hidden="true">
                    {opt.name.slice(0, 1)}
                  </div>
                )}
              </div>
              {opt.moderationStatus === 'PENDING_MODERATION' && !opt.isGlobal && (
                <span className="preset-grid__moderation-badge" aria-label="На модерации">
                  На модерации
                </span>
              )}
              <div className="pack-card__title-overlay">{opt.name}</div>
              {isSelected && <span className="preset-grid__selected-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
