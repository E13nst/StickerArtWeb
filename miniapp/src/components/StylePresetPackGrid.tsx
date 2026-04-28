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
  fallbackPreviewByPresetCode?: Partial<Record<string, string>>;
  disabled?: boolean;
}

type PresetGridOption = {
  id: number | null;
  name: string;
  code?: string;
  previewUrl?: string | null;
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
  fallbackPreviewByPresetCode,
  disabled = false,
}) => {
  const { tg } = useTelegram();

  const options: PresetGridOption[] = [
    { id: null, name: 'Свой prompt', code: 'custom' },
    ...presets.map((p) => ({
      id: p.id,
      name: stripPresetName(p.name),
      code: p.code,
      previewUrl:
        previewByPresetId?.get(p.id) ??
        (p.code ? fallbackPreviewByPresetCode?.[p.code] : undefined) ??
        getServerPreviewUrl(p),
    })),
  ];

  const handleSelect = (presetId: number | null) => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    onPresetChange(presetId);
  };

  return (
    <div className="style-preset-pack-grid" role="listbox" aria-label="Стиль генерации">
      {options.map((opt) => {
        const isSelected = selectedPresetId === opt.id;
        return (
          <button
            key={opt.id === null ? 'none' : opt.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={disabled}
            className={[
              'style-preset-pack-grid__card',
              'pack-card',
              isSelected && 'style-preset-pack-grid__card--selected',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleSelect(opt.id)}
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
                />
              ) : (
                <div className="pack-card__placeholder" aria-hidden="true">
                  {opt.id === null ? '+' : opt.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="pack-card__title-overlay">{opt.name}</div>
          </button>
        );
      })}
    </div>
  );
};
