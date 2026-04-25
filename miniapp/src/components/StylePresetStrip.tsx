import { FC } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { StylePreset } from '@/api/client';
import './StylePresetStrip.css';

interface StylePresetStripProps {
  presets: StylePreset[];
  selectedPresetId: number | null;
  onPresetChange: (presetId: number | null) => void;
  previewByPresetId?: Map<number, string>;
  fallbackPreviewByPresetCode?: Partial<Record<string, string>>;
  disabled?: boolean;
}

type StylePresetOption = {
  id: number | null;
  name: string;
  code?: string;
  previewUrl?: string | null;
};

const getServerPreviewUrl = (preset: StylePreset): string | null => {
  return preset.previewWebpUrl ?? preset.previewUrl ?? null;
};

/** Horizontal inspiration cards for generation presets. */
export const StylePresetStrip: FC<StylePresetStripProps> = ({
  presets,
  selectedPresetId,
  onPresetChange,
  previewByPresetId,
  fallbackPreviewByPresetCode,
  disabled = false,
}) => {
  const { tg } = useTelegram();

  const stripPresetName = (name: string) =>
    name.replace(/\s*Sticker\s*/gi, ' ').replace(/\s*Style\s*/gi, ' ').replace(/\s+/g, ' ').trim();

  const options: StylePresetOption[] = [
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
    <div className="style-preset-strip">
      <div className="style-preset-strip__scroll" role="listbox" aria-label="Стиль">
        {options.map((opt) => {
          const isSelected = selectedPresetId === opt.id;
          return (
            <button
              key={opt.id === null ? 'none' : opt.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={disabled}
              className={['style-preset-strip__card', isSelected && 'style-preset-strip__card--selected']
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSelect(opt.id)}
            >
              <div
                className={['style-preset-strip__media', !opt.previewUrl && 'style-preset-strip__media--empty']
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {opt.previewUrl ? (
                  <img
                    src={opt.previewUrl}
                    alt=""
                    className="style-preset-strip__image"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="style-preset-strip__placeholder">
                    {opt.id === null ? '+' : opt.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <span className="style-preset-strip__label">{opt.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
